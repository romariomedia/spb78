package ru.sportbuddy.mobile;

import android.content.Context;
import android.util.Base64;
import com.getcapacitor.JSObject;
import java.io.*;
import java.util.UUID;

/** Keep PNG bytes out of Capacitor's saved Activity state / Binder transactions. */
final class RunningCardFile {
    static File prepare(Context context, JSObject options) throws Exception {
        String data = options.optString("data", null);
        options.remove("data");
        if (data == null || data.length() > 12000000) throw new IOException("Некорректная карточка");
        byte[] bytes = Base64.decode(data, Base64.DEFAULT);
        byte[] signature = {(byte)137, 80, 78, 71, 13, 10, 26, 10};
        if (bytes.length < signature.length) throw new IOException("Некорректный PNG");
        for (int i=0; i<signature.length; i++) if (bytes[i]!=signature[i]) throw new IOException("Некорректный PNG");
        File dir = new File(context.getCacheDir(), "running-cards");
        if (!dir.exists() && !dir.mkdirs()) throw new IOException("Нет места для карточки");
        File[] old = dir.listFiles();
        if (old != null) for (File f : old) if (f.lastModified() < System.currentTimeMillis()-86400000L) f.delete();
        File file = new File(dir, "run-"+UUID.randomUUID()+".png");
        try (FileOutputStream out = new FileOutputStream(file)) { out.write(bytes); }
        catch (Exception e) { file.delete(); throw e; }
        options.put("cardFile", file.getName());
        return file;
    }
    static File get(Context context, JSObject options) throws IOException {
        String name = options.optString("cardFile");
        if (!name.matches("run-[a-f0-9-]{36}\\.png")) throw new IOException("Карточка недоступна. Сохраните её заново.");
        File file = new File(new File(context.getCacheDir(), "running-cards"), name);
        if (!file.isFile()) throw new IOException("Карточка недоступна. Сохраните её заново.");
        return file;
    }
    static void delete(Context context, JSObject options) {
        try { get(context, options).delete(); } catch (IOException ignored) {}
    }
}
