package ru.sportbuddy.mobile;

import android.Manifest;
import android.content.Intent;
import android.os.*;
import androidx.core.content.ContextCompat;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import org.json.*;

@CapacitorPlugin(name = "RunningRecorder", permissions = {
    @Permission(alias = "location", strings = {Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}),
    @Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS})
})
public class RunningRecorderPlugin extends Plugin {
    private final java.util.concurrent.atomic.AtomicBoolean cardSaving = new java.util.concurrent.atomic.AtomicBoolean();
    private static final java.util.concurrent.ConcurrentHashMap<String,Integer> epochs = new java.util.concurrent.ConcurrentHashMap<>();
    static boolean isCurrentStart(String owner, int epoch) { return owner != null && epochs.getOrDefault(owner, 0) == epoch; }
    @PluginMethod public void cardCapabilities(PluginCall call) { call.resolve(new JSObject().put("save", true)); }
    private byte[] cardBytes(PluginCall call) throws Exception {
        String data = call.getString("data");
        if (data == null || data.length() > 12000000) throw new Exception("Некорректная карточка");
        byte[] bytes = android.util.Base64.decode(data, android.util.Base64.DEFAULT);
        byte[] signature = {(byte)137, 80, 78, 71, 13, 10, 26, 10};
        if (bytes.length < signature.length) throw new Exception("Некорректный PNG");
        for (int i = 0; i < signature.length; i++) if (bytes[i] != signature[i]) throw new Exception("Некорректный PNG");
        return bytes;
    }
    @PluginMethod public void saveCard(PluginCall call) {
        if (!cardSaving.compareAndSet(false, true)) { call.reject("Дождитесь завершения сохранения карточки"); return; }
        try {
            RunningCardFile.prepare(getContext(), call.getData());
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                .setType("image/png").putExtra(Intent.EXTRA_TITLE, "sportbuddy-run-" + System.currentTimeMillis() + ".png");
            getActivity().runOnUiThread(() -> {
                try { startActivityForResult(call, intent, "cardDestination"); }
                catch (Exception e) { RunningCardFile.delete(getContext(), call.getData()); cardSaving.set(false); call.reject("Не удалось открыть сохранение карточки", e); }
            });
        } catch (Exception e) { cardSaving.set(false); call.reject("Не удалось подготовить сохранение карточки", e); }
    }
    @ActivityCallback private void cardDestination(PluginCall call, ActivityResult result) {
        if (call == null) { cardSaving.set(false); return; }
        if (result.getResultCode() != android.app.Activity.RESULT_OK) {
            RunningCardFile.delete(getContext(), call.getData()); cardSaving.set(false);
            call.resolve(new JSObject().put("cancelled", true)); return;
        }
        android.net.Uri uri = result.getData() == null ? null : result.getData().getData();
        if (uri == null) { RunningCardFile.delete(getContext(), call.getData()); cardSaving.set(false); call.reject("Папка для сохранения не выбрана"); return; }
        // Cloud document providers may block: never write the PNG on the UI thread.
        new Thread(() -> {
            try {
                try (java.io.InputStream in = new java.io.FileInputStream(RunningCardFile.get(getContext(), call.getData()));
                     java.io.OutputStream out = getContext().getContentResolver().openOutputStream(uri, "w")) {
                    if (out == null) throw new Exception("Не удалось открыть файл");
                    byte[] buffer = new byte[16384]; int count;
                    while ((count = in.read(buffer)) != -1) out.write(buffer, 0, count);
                    out.flush();
                }
                call.resolve(new JSObject().put("cancelled", false));
            } catch (Exception e) { call.reject("Не удалось сохранить карточку", e); }
            finally { RunningCardFile.delete(getContext(), call.getData()); cardSaving.set(false); }
        }, "running-card-save").start();
    }
    @PluginMethod public void shareCard(PluginCall call) {
        try {
            byte[] bytes = cardBytes(call);
            java.io.File directory = new java.io.File(getContext().getCacheDir(), "running-cards");
            if (!directory.exists() && !directory.mkdirs()) throw new Exception("Нет места для карточки");
            java.io.File[] old = directory.listFiles();
            if (old != null) for (java.io.File f : old) if (f.lastModified() < System.currentTimeMillis()-86400000L) f.delete();
            java.io.File file = new java.io.File(directory, "run-"+java.util.UUID.randomUUID()+".png");
            try (java.io.FileOutputStream out = new java.io.FileOutputStream(file)) { out.write(bytes); }
            android.net.Uri uri = androidx.core.content.FileProvider.getUriForFile(getContext(), getContext().getPackageName()+".fileprovider", file);
            Intent share = new Intent(Intent.ACTION_SEND).setType("image/png").putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            share.setClipData(android.content.ClipData.newRawUri("Результат пробежки", uri));
            getActivity().runOnUiThread(() -> { try { getActivity().startActivity(Intent.createChooser(share,"Поделиться результатом")); call.resolve(); } catch (Exception e) { call.reject("Не удалось открыть меню отправки", e); } });
        } catch (Exception e) { call.reject("Не удалось подготовить карточку", e); }
    }
    private String owner(PluginCall call) throws Exception {
        String owner = call.getString("owner");
        if (owner == null || owner.isEmpty() || owner.length() > 128) throw new Exception("Требуется аккаунт");
        return owner;
    }
    private void resolve(PluginCall call, String owner) throws Exception {
        RunningService service = RunningService.current;
        boolean matching = service != null && owner.equals(service.owner);
        if (!matching || !service.recording) RunStore.clearPending(getContext(), owner);
        JSONObject draft = RunStore.read(getContext(), owner);
        JSObject result = new JSObject().put("draft", draft == null ? JSONObject.NULL : draft)
            .put("recording", matching && service.recording).put("error", matching ? service.error : "");
        call.resolve(result);
    }
    @PluginMethod public void snapshot(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try { resolve(call, owner(call)); } catch (Exception e) { call.reject("Не удалось прочитать черновик", e); }
        });
    }
    @PluginMethod public void start(PluginCall call) {
        // Capacitor invokes plugin methods on a worker; permission launchers require main.
        getActivity().runOnUiThread(() -> {
          try {
        try { call.getData().put("recorderEpoch", epochs.merge(owner(call), 1, Integer::sum)); }
        catch (Exception e) { call.reject("Требуется аккаунт", e); return; }
        if (getPermissionState("location") != PermissionState.GRANTED) {
            requestPermissionForAlias("location", call, "locationPermission"); return;
        }
        requestNotification(call);
          } catch (Exception e) { call.reject("Не удалось запросить разрешения для пробежки", e); }
        });
    }
    @PermissionCallback private void locationPermission(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) { call.reject("Разрешите точное местоположение для записи пробежки"); return; }
        requestNotification(call);
    }
    private void requestNotification(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") == PermissionState.PROMPT) {
            requestPermissionForAlias("notifications", call, "notificationPermission"); return;
        }
        begin(call);
    }
    @PermissionCallback private void notificationPermission(PluginCall call) { begin(call); }
    private void begin(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                String owner = owner(call);
                int epoch = call.getData().optInt("recorderEpoch");
                if (!isCurrentStart(owner, epoch)) { call.reject("Запуск записи отменён"); return; }
                RunningService service = RunningService.current;
                if (service != null && service.recording) {
                    if (owner.equals(service.owner)) { resolve(call, owner); return; }
                    service.stopRun(false);
                }
                RunStore.clearPending(getContext(), owner);
                JSONObject draft = RunStore.read(getContext(), owner);
                if (draft == null) {
                    draft = call.getObject("draft");
                    if (draft == null || !draft.optString("id").matches("run_[a-zA-Z0-9-]{8,80}") || draft.optLong("startedAt") <= 0
                        || draft.optJSONArray("points") == null || draft.getJSONArray("points").length() > RunStore.MAX_POINTS) throw new Exception("Некорректный черновик");
                    draft.put("pendingStart", true);
                } else {
                    draft.put("segment", draft.optInt("segment") + 1);
                }
                if (draft.has("endedAt")) throw new Exception("Пробежка уже завершена");
                RunStore.write(getContext(), owner, draft);
                Intent intent = new Intent(getContext(), RunningService.class).setAction("start").putExtra("owner", owner).putExtra("epoch", epoch);
                intent.putExtra("reply", new ResultReceiver(new Handler(Looper.getMainLooper())) {
                    @Override protected void onReceiveResult(int code, Bundle result) {
                        try { if (code == 0) resolve(call, owner); else call.reject(result.getString("error", "GPS недоступен")); }
                        catch (Exception e) { call.reject("Не удалось прочитать состояние записи", e); }
                    }
                });
                ContextCompat.startForegroundService(getContext(), intent);
            } catch (Exception e) {
                try { RunStore.clearPending(getContext(), owner(call)); } catch (Exception ignored) {}
                call.reject(e.getMessage(), e);
            }
        });
    }
    @PluginMethod public void pause(PluginCall call) { stop(call, false, false); }
    @PluginMethod public void finish(PluginCall call) { stop(call, true, false); }
    @PluginMethod public void discard(PluginCall call) { stop(call, false, true); }
    private void stop(PluginCall call, boolean finish, boolean discard) {
        getActivity().runOnUiThread(() -> {
            try {
                String owner = owner(call);
                epochs.merge(owner, 1, Integer::sum);
                RunningService service = RunningService.current;
                if (service != null && owner.equals(service.owner)) service.stopRun(finish);
                else if (finish) {
                    JSONObject draft = RunStore.read(getContext(), owner);
                    if (draft != null && !draft.has("endedAt")) {
                        draft.put("endedAt", Math.min(System.currentTimeMillis(), draft.getLong("startedAt") + RunStore.MAX_DURATION));
                        RunStore.write(getContext(), owner, draft);
                    }
                }
                if (discard) RunStore.delete(getContext(), owner);
                resolve(call, owner);
            } catch (Exception e) { call.reject("Не удалось изменить запись пробежки", e); }
        });
    }
}
