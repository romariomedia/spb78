package ru.sportbuddy.mobile;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Context;
import android.content.Intent;
import android.os.Parcel;
import android.util.Base64;
import androidx.core.content.FileProvider;
import androidx.test.core.app.ActivityScenario;
import androidx.test.espresso.intent.Intents;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import java.io.File;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.junit.Test;
import org.junit.runner.RunWith;
import static androidx.test.espresso.intent.Intents.intending;
import static androidx.test.espresso.intent.matcher.IntentMatchers.hasAction;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class RunningLifecycleTest {
    private static class Call extends PluginCall {
        final CountDownLatch done = new CountDownLatch(1);
        volatile JSObject result;
        volatile String error;
        Call(String method, JSObject data) {
            super(null, "RunningRecorder", java.util.UUID.randomUUID().toString(), method, data);
        }
        @Override public void resolve(JSObject data) { result=data; done.countDown(); }
        @Override public void resolve() { result=new JSObject(); done.countDown(); }
        @Override public void reject(String message, String code, Exception cause, JSObject data) {
            error=message; done.countDown();
        }
        JSObject await() throws Exception {
            assertTrue("Native callback timed out", done.await(15, TimeUnit.SECONDS));
            assertNull(error, error);
            return result;
        }
    }
    private Context context() { return InstrumentationRegistry.getInstrumentation().getTargetContext(); }
    private RunningRecorderPlugin plugin(ActivityScenario<MainActivity> scenario) {
        RunningRecorderPlugin[] result=new RunningRecorderPlugin[1];
        scenario.onActivity(a -> result[0]=(RunningRecorderPlugin)a.getBridge().getPlugin("RunningRecorder").getInstance());
        return result[0];
    }
    @Test public void workerStartRequestsPermissionOnMainThread() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            MainActivity[] activity=new MainActivity[1];
            scenario.onActivity(a -> activity[0]=a);
            RunningRecorderPlugin plugin=new RunningRecorderPlugin() {
                @Override public androidx.appcompat.app.AppCompatActivity getActivity() { return activity[0]; }
                @Override public com.getcapacitor.PermissionState getPermissionState(String alias) { return com.getcapacitor.PermissionState.PROMPT; }
                @Override protected void requestPermissionForAlias(String alias, PluginCall call, String callback) {
                    assertEquals(android.os.Looper.getMainLooper(),android.os.Looper.myLooper());
                    call.resolve(new JSObject().put("requested",alias));
                }
            };
            Call call=new Call("start",new JSObject().put("owner","test-permission"));
            plugin.start(call);
            assertEquals("location",call.await().getString("requested"));
        }
    }
    @Test public void startPauseResumeAndFinishReplyWithoutLosingDraft() throws Exception {
        String owner="test-"+java.util.UUID.randomUUID();
        Instrumentation instrumentation=InstrumentationRegistry.getInstrumentation();
        for(String permission:new String[]{"android.permission.ACCESS_COARSE_LOCATION","android.permission.ACCESS_FINE_LOCATION"}) {
            try(java.io.InputStream output=new android.os.ParcelFileDescriptor.AutoCloseInputStream(instrumentation.getUiAutomation().executeShellCommand("pm grant "+context().getPackageName()+" "+permission))) {
                while(output.read()!=-1) {}
            }
        }
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            RunningRecorderPlugin plugin=plugin(scenario);
            JSObject draft=new JSObject().put("id","run_test123456").put("routeId","").put("startedAt",System.currentTimeMillis())
                .put("segment",0).put("points",new JSONArray());
            Call start=new Call("start",new JSObject().put("owner",owner).put("draft",draft));
            plugin.start(start); assertTrue(start.await().getBoolean("recording",false));
            assertFalse(RunStore.read(context(),owner).optBoolean("pendingStart"));
            Call pause=new Call("pause",new JSObject().put("owner",owner));
            plugin.pause(pause); assertFalse(pause.await().getBoolean("recording",true));
            instrumentation.waitForIdleSync();
            Call resume=new Call("start",new JSObject().put("owner",owner));
            plugin.start(resume); assertTrue(resume.await().getBoolean("recording",false));
            Call finish=new Call("finish",new JSObject().put("owner",owner));
            plugin.finish(finish); assertTrue(finish.await().getJSObject("draft").has("endedAt"));
        } finally { RunStore.delete(context(),owner); }
    }
    @Test public void largePngUsesSmallSavedStateAndCopiesExactBytes() throws Exception {
        byte[] bytes=new byte[2*1024*1024];
        byte[] header={(byte)137,80,78,71,13,10,26,10};
        System.arraycopy(header,0,bytes,0,header.length);
        File target=new File(context().getCacheDir(),"card-save-test.png");
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            RunningRecorderPlugin plugin=plugin(scenario);
            Intents.init();
            try {
                Intent data=new Intent().setData(FileProvider.getUriForFile(context(),context().getPackageName()+".fileprovider",target));
                intending(hasAction(Intent.ACTION_CREATE_DOCUMENT)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_OK,data));
                Call save=new Call("saveCard",new JSObject().put("data",Base64.encodeToString(bytes,Base64.NO_WRAP)));
                plugin.saveCard(save); assertFalse(save.await().getBoolean("cancelled",true));
                assertFalse(save.getData().has("data"));
                Parcel state=Parcel.obtain();
                try { state.writeString(save.getData().toString()); state.writeString(save.getData().toString()); assertTrue(state.dataSize()<50000); }
                finally { state.recycle(); }
                assertArrayEquals(bytes,java.nio.file.Files.readAllBytes(target.toPath()));
            } finally { Intents.release(); }
        } finally { target.delete(); }
    }
    @Test public void cancellingSaveIsNotAnErrorAndRemovesStagedFile() throws Exception {
        byte[] bytes={(byte)137,80,78,71,13,10,26,10};
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            RunningRecorderPlugin plugin=plugin(scenario);
            Intents.init();
            try {
                intending(hasAction(Intent.ACTION_CREATE_DOCUMENT)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_CANCELED,null));
                Call save=new Call("saveCard",new JSObject().put("data",Base64.encodeToString(bytes,Base64.NO_WRAP)));
                plugin.saveCard(save); assertTrue(save.await().getBoolean("cancelled",false));
                assertFalse(new File(new File(context().getCacheDir(),"running-cards"),save.getData().getString("cardFile")).exists());
            } finally { Intents.release(); }
        }
    }
    @Test public void recoveryDropsOnlyUncommittedStarts() throws Exception {
        String owner="test-"+java.util.UUID.randomUUID();
        try {
            JSObject draft=new JSObject().put("id","run_pending123").put("pendingStart",true);
            RunStore.write(context(),owner,draft); RunStore.clearPending(context(),owner); assertNull(RunStore.read(context(),owner));
            draft.remove("pendingStart"); RunStore.write(context(),owner,draft);
            RunStore.clearPending(context(),owner); assertNotNull(RunStore.read(context(),owner));
        } finally { RunStore.delete(context(),owner); }
    }
}
