package ru.sportbuddy.mobile;

import android.app.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.location.*;
import android.os.*;
import androidx.core.app.NotificationCompat;
import org.json.*;

/** User-started location foreground service; never depends on WebView timers. */
public class RunningService extends Service implements LocationListener {
    static RunningService current;
    static final String CHANNEL = "sportbuddy-running";
    static final int NOTIFICATION = 7803;
    String owner;
    JSONObject draft;
    String error = "";
    boolean recording;
    private LocationManager locations;
    private final Handler timer = new Handler(Looper.getMainLooper());
    private PowerManager.WakeLock wakeLock;
    private final Runnable deadline = () -> stopRun(true);

    @Override public IBinder onBind(Intent intent) { return null; }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) { stopSelf(); return START_NOT_STICKY; }
        String action = intent.getAction();
        String requestedOwner = intent.getStringExtra("owner");
        String requestedId = intent.getStringExtra("runId");
        if ("pause".equals(action) || "finish".equals(action)) {
            if (owner != null && owner.equals(requestedOwner) && draft != null && draft.optString("id").equals(requestedId)) stopRun("finish".equals(action));
            if (owner == null) stopSelf();
            return START_NOT_STICKY;
        }
        ResultReceiver reply = intent.getParcelableExtra("reply");
        if (!RunningRecorderPlugin.isCurrentStart(requestedOwner, intent.getIntExtra("epoch", -1)) || recording) {
            Bundle result = new Bundle(); result.putString("error", "Запуск отменён или запись уже идёт");
            if (reply != null) reply.send(1, result);
            if (!recording) stopSelf();
            return START_NOT_STICKY;
        }
        try {
            error = "";
            owner = requestedOwner;
            draft = RunStore.read(this, owner);
            if (draft == null || draft.has("endedAt")) throw new Exception("Нет активного черновика");
            long remaining = draft.getLong("startedAt") + RunStore.MAX_DURATION - System.currentTimeMillis();
            if (remaining <= 0) throw new Exception("Достигнут лимит 6 часов");
            locations = (LocationManager) getSystemService(LOCATION_SERVICE);
            if (!locations.isProviderEnabled(LocationManager.GPS_PROVIDER)) throw new Exception("Включите GPS на устройстве");
            NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(new NotificationChannel(CHANNEL, "Запись пробежки", NotificationManager.IMPORTANCE_LOW));
            Notification notification = notification();
            if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFICATION, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            else startForeground(NOTIFICATION, notification);
            current = this;
            locations.requestLocationUpdates(LocationManager.GPS_PROVIDER, 2000L, 0f, this, Looper.getMainLooper());
            PowerManager power = (PowerManager) getSystemService(POWER_SERVICE);
            wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "SportBuddy78:running");
            wakeLock.acquire(remaining);
            recording = true;
            timer.postDelayed(deadline, remaining);
            if (reply != null) reply.send(0, Bundle.EMPTY);
        } catch (Exception e) {
            error = e.getMessage() == null ? "Не удалось запустить GPS" : e.getMessage();
            Bundle result = new Bundle(); result.putString("error", error);
            if (reply != null) reply.send(1, result);
            stopRun(false);
        }
        // A killed process is restored as a paused draft, never silently restarted.
        return START_NOT_STICKY;
    }
    private Notification notification() {
        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent content = PendingIntent.getActivity(this, 7803, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_sportbuddy).setContentTitle("SportBuddy78 · идёт пробежка")
            .setContentText("GPS записывается. Можно выключить экран.")
            .setContentIntent(content).setOngoing(true).setOnlyAlertOnce(true)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setWhen(draft.optLong("startedAt")).setUsesChronometer(true)
            .addAction(0, "Пауза", action("pause", 7804))
            .addAction(0, "Завершить", action("finish", 7805)).build();
    }
    private PendingIntent action(String action, int code) {
        Intent intent = new Intent(this, RunningService.class).setAction(action).putExtra("owner", owner).putExtra("runId", draft.optString("id"));
        return PendingIntent.getService(this, code, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    @Override public void onLocationChanged(Location location) {
        if (!recording || draft == null) return;
        try {
            long now = System.currentTimeMillis(), end = draft.getLong("startedAt") + RunStore.MAX_DURATION;
            if (now >= end) { stopRun(true); return; }
            if (!location.hasAccuracy() || location.getAccuracy() > 50 || location.getAccuracy() < 0) return;
            long timestamp = location.getTime();
            if (timestamp < draft.getLong("startedAt") || timestamp > now) return;
            JSONArray points = draft.getJSONArray("points");
            if (points.length() > 0 && timestamp - points.getJSONObject(points.length()-1).getLong("timestamp") < 2000) return;
            if (points.length() >= RunStore.MAX_POINTS) { stopRun(true); return; }
            JSONObject point = new JSONObject().put("lat", location.getLatitude()).put("lng", location.getLongitude())
                .put("accuracy", location.getAccuracy()).put("timestamp", timestamp).put("segment", draft.getInt("segment"));
            points.put(point);
            RunStore.write(this, owner, draft);
        } catch (Exception e) { error = "Не удалось сохранить GPS на устройстве. Запись приостановлена."; stopRun(false); }
    }
    void stopRun(boolean finish) {
        recording = false;
        if (locations != null) locations.removeUpdates(this);
        timer.removeCallbacks(deadline);
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        if (finish && draft != null && !draft.has("endedAt")) {
            try {
                long end = Math.min(System.currentTimeMillis(), draft.getLong("startedAt") + RunStore.MAX_DURATION);
                draft.put("endedAt", end);
                RunStore.write(this, owner, draft);
            } catch (Exception e) { error = "Не удалось записать завершение. Откройте приложение."; }
        }
        stopForeground(true);
        stopSelf();
    }
    @Override public void onDestroy() {
        recording = false;
        if (locations != null) locations.removeUpdates(this);
        timer.removeCallbacks(deadline);
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        if (current == this) current = null;
        super.onDestroy();
    }
    @Override public void onProviderDisabled(String provider) { error = "GPS выключен. Включите его и продолжите запись."; stopRun(false); }
    @Override public void onProviderEnabled(String provider) {}
    @Override public void onStatusChanged(String provider, int status, Bundle extras) {}
}
