package ru.sportbuddy.mobile;

import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class RunningStoreTest {
    @Test public void restartReadsCompleteDraftAndAccountsRemainIsolated() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        String owner = "test-" + java.util.UUID.randomUUID(), other = "test-" + java.util.UUID.randomUUID();
        try {
            JSONObject draft = new JSONObject().put("id", "run_test123456").put("routeId", "park300")
                .put("routeVersion", 1).put("startedAt", 1000).put("segment", 0)
                .put("points", new JSONArray().put(new JSONObject().put("lat",59.984).put("lng",30.202).put("timestamp",2000).put("accuracy",4).put("segment",0)));
            RunStore.write(context, owner, draft);
            assertNull(RunStore.read(context, other));
            JSONObject recovered = RunStore.read(context, owner);
            assertEquals(1, recovered.getJSONArray("points").length());
            assertEquals("run_test123456", recovered.getString("id"));
            recovered.put("endedAt", 5000);RunStore.write(context, owner, recovered);
            assertEquals(5000, RunStore.read(context, owner).getLong("endedAt"));
            RunStore.delete(context, other);
            assertNotNull(RunStore.read(context, owner));
            RunStore.delete(context, owner);assertNull(RunStore.read(context, owner));
        } finally { RunStore.delete(context,owner);RunStore.delete(context,other); }
    }
}
