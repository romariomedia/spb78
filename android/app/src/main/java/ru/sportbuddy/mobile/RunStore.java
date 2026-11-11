package ru.sportbuddy.mobile;

import android.content.Context;
import android.util.AtomicFile;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/** Private, atomic, excluded from Android backup. One unfinished run per account. */
final class RunStore {
    static final long MAX_DURATION = 6 * 60 * 60 * 1000L;
    static final int MAX_POINTS = 12000;
    private static AtomicFile file(Context context, String owner) throws Exception {
        if (owner == null || owner.isEmpty() || owner.length() > 128) throw new Exception("Требуется аккаунт");
        byte[] hash = MessageDigest.getInstance("SHA-256").digest(owner.getBytes(StandardCharsets.UTF_8));
        StringBuilder name = new StringBuilder("running-");
        for (byte b : hash) name.append(String.format("%02x", b));
        return new AtomicFile(new File(context.getNoBackupFilesDir(), name + ".json"));
    }
    static synchronized JSONObject read(Context context, String owner) throws Exception {
        AtomicFile f = file(context, owner);
        if (!f.getBaseFile().exists() && !new File(f.getBaseFile() + ".bak").exists()) return null;
        return new JSONObject(new String(f.readFully(), StandardCharsets.UTF_8));
    }
    static synchronized void write(Context context, String owner, JSONObject draft) throws Exception {
        AtomicFile f = file(context, owner);
        FileOutputStream out = null;
        try {
            out = f.startWrite();
            out.write(draft.toString().getBytes(StandardCharsets.UTF_8));
            f.finishWrite(out);
        } catch (Exception e) { if (out != null) f.failWrite(out); throw e; }
    }
    static synchronized void delete(Context context, String owner) throws Exception { file(context, owner).delete(); }
}
