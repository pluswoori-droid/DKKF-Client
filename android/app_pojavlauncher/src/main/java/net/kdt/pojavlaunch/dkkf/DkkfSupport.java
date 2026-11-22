package net.kdt.pojavlaunch.dkkf;

import android.app.Activity;
import android.app.ProgressDialog;
import android.content.Context;
import android.os.Build;
import androidx.appcompat.app.AlertDialog;
import net.kdt.pojavlaunch.*;
import net.kdt.pojavlaunch.extra.*;
import net.kdt.pojavlaunch.multirt.MultiRTUtils;
import net.kdt.pojavlaunch.prefs.LauncherPreferences;
import net.kdt.pojavlaunch.value.launcherprofiles.*;
import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.jar.JarFile;

/** DKKF's server preparation layer; rendering/JVM/touch support remains Amethyst's. */
public final class DkkfSupport {
    public static Context context;
    public static final String PROFILE = "d812d24a-78c3-4bdb-bb33-5380ad66a410";
    public static final String VERSION = "fabric-loader-0.20.1-26.3";
    public static final String SERVER = "dkkf.mc-hosting.xyz";
    private static final AtomicBoolean working = new AtomicBoolean();
    private static boolean handoff;

    public static String clientId() throws IOException, JSONException {
        try(InputStream in=context.getAssets().open("dkkf/microsoft-app.json")) {
            return new JSONObject(Tools.read(in)).getString("clientId");
        }
    }
    public static String clientIdUnchecked() {
        try {return clientId();} catch(Exception e) {throw new IllegalStateException("Microsoft app configuration unavailable.");}
    }
    public static void selectProfile() {
        LauncherProfiles.load();
        MinecraftProfile p=LauncherProfiles.mainProfileJson.profiles.get(PROFILE);
        if(p==null) p=MinecraftProfile.createTemplate();
        p.name="DKKF Server · Fabric 26.3";
        p.lastVersionId=VERSION;
        p.gameDir=new File(Tools.DIR_GAME_HOME,"dkkf-server").getAbsolutePath();
        p.javaDir=Tools.LAUNCHERPROFILES_RTPREFIX+"External-25";
        if(p.pojavRendererName==null || p.pojavRendererName.isEmpty()) p.pojavRendererName="opengles_mobileglues";
        LauncherProfiles.mainProfileJson.profiles.put(PROFILE,p);
        LauncherPreferences.DEFAULT_PREF.edit().putString(LauncherPreferences.PREF_KEY_CURRENT_PROFILE,PROFILE).apply();
        LauncherProfiles.write();
    }
    /** One prepare pass for each user launch; the callback re-enters the native launch listener once. */
    public static boolean beforeLaunch(Activity activity) {
        if(handoff) { handoff=false; return false; }
        if(!working.compareAndSet(false,true)) return true;
        ProgressDialog dialog=new ProgressDialog(activity);
        dialog.setTitle(R.string.dkkf_prepare);
        dialog.setMessage(activity.getString(R.string.dkkf_prepare_detail));
        dialog.setCancelable(false);dialog.show();
        PojavApplication.sExecutorService.execute(()->{
            try {
                prepare(activity, text->activity.runOnUiThread(()->dialog.setMessage(text)));
                activity.runOnUiThread(()->{working.set(false);dialog.dismiss();
                    if(!activity.isFinishing()) {handoff=true;ExtraCore.setValue(ExtraConstants.LAUNCH_GAME,true);}
                });
            } catch(Exception error) {
                activity.runOnUiThread(()->{working.set(false);dialog.dismiss();
                    if(!activity.isFinishing()) new AlertDialog.Builder(activity).setTitle(R.string.dkkf_prepare_failed)
                        .setMessage(safeError(error)).setPositiveButton(android.R.string.ok,null).show();
                });
            }
        });
        return true;
    }
    private interface Progress {void show(String message);}
    private static void prepare(Activity activity,Progress progress) throws Exception {
        if(!Arrays.asList(Build.SUPPORTED_ABIS).contains("arm64-v8a")) throw new IOException("This preview requires an ARM64 Android device.");
        selectProfile();
        JSONObject config;
        try(InputStream in=activity.getAssets().open("dkkf/server-profile.json")) {config=new JSONObject(Tools.read(in));}
        File cache=new File(Tools.DIR_CACHE,"dkkf");if(!cache.isDirectory()&&!cache.mkdirs())throw new IOException("Cannot create download cache.");
        JSONObject runtimeSpec=config.getJSONObject("androidRuntime");
        File runtimeMarker=new File(Tools.MULTIRT_HOME,"External-25/.dkkf-complete");
        boolean complete=runtimeMarker.isFile() && runtimeSpec.getString("sha256").equals(new String(Files.readAllBytes(runtimeMarker.toPath()),StandardCharsets.UTF_8));
        if(MultiRTUtils.getExactJreName(25)==null || !complete) {
            progress.show(activity.getString(R.string.dkkf_java25));
            JSONObject rt=config.getJSONObject("androidRuntime");File archive=new File(cache,"java25-arm64.tar.xz");
            download(rt.getString("url"),archive,rt.getString("sha256"));
            MultiRTUtils.installRuntimeNamed(Tools.NATIVE_LIB_DIR,new FileInputStream(archive),"External-25");
            MultiRTUtils.postPrepare("External-25");
            Tools.write(runtimeMarker.getAbsolutePath(),rt.getString("sha256"));
        }
        LauncherPreferences.PREF_DEFAULT_RUNTIME=MultiRTUtils.getExactJreName(25);
        if(LauncherPreferences.PREF_DEFAULT_RUNTIME==null)throw new IOException("Java 25 installation did not complete.");
        LauncherPreferences.DEFAULT_PREF.edit().putString("defaultRuntime",LauncherPreferences.PREF_DEFAULT_RUNTIME).apply();
        progress.show(activity.getString(R.string.dkkf_fabric));
        JSONObject fabric=getJson("https://meta.fabricmc.net/v2/versions/loader/26.3/0.20.1/profile/json");
        if(!VERSION.equals(fabric.getString("id"))||!"26.3".equals(fabric.getString("inheritsFrom")))throw new IOException("Unexpected Fabric profile.");
        Tools.write(new File(new File(Tools.DIR_HOME_VERSION,VERSION),VERSION+".json").getAbsolutePath(),fabric.toString());
        File game=new File(LauncherProfiles.getCurrentProfile().gameDir),mods=new File(game,"mods");
        if(!mods.isDirectory()&&!mods.mkdirs())throw new IOException("Cannot create mods directory.");
        JSONArray entries=config.getJSONArray("mods");List<File> prepared=new ArrayList<>();
        for(int n=0;n<entries.length();n++) {
            JSONObject item=entries.getJSONObject(n);progress.show(item.getString("name"));
            String name=item.getString("file");if(!name.matches("[A-Za-z0-9._+\\-]+\\.jar"))throw new IOException("Invalid mod filename.");
            String hash=item.getString("sha256");File dest=new File(cache,hash+"-"+name);
            if(!matches(dest,hash)) {
                if(item.getString("url").isEmpty()) {
                    File temp=new File(dest+".part");
                    try(InputStream in=activity.getAssets().open("dkkf/mods/"+name);OutputStream out=new FileOutputStream(temp)) {copy(in,out,256L*1024*1024);}
                    verify(temp,hash);Files.move(temp.toPath(),dest.toPath(),StandardCopyOption.REPLACE_EXISTING);
                } else download(item.getString("url"),dest,hash);
            }
            if(!item.getString("id").equals(modId(dest)))throw new IOException("Wrong mod ID: "+name);
            prepared.add(dest);
        }
        File backup=new File(game,"backups/server-"+System.currentTimeMillis());
        File[] existing=mods.listFiles((dir,name)->name.endsWith(".jar")||name.endsWith(".jar.disabled"));
        for(File f:existing==null?new File[0]:existing) {
            String id=modId(f);boolean remove="dkkf_core".equals(id);
            for(int n=0;n<entries.length();n++)if(entries.getJSONObject(n).getString("id").equals(id)) {
                JSONObject spec=entries.getJSONObject(n);
                if(!f.getName().equals(spec.getString("file"))||!matches(f,spec.getString("sha256"))) remove=true;
            }
            if(remove) {if(!backup.isDirectory()&&!backup.mkdirs())throw new IOException("Cannot create mod backup.");
                Files.move(f.toPath(),new File(backup,f.getName()).toPath());}
        }
        for(int n=0;n<entries.length();n++) {
            JSONObject spec=entries.getJSONObject(n);File target=new File(mods,spec.getString("file"));
            if(matches(target,spec.getString("sha256")))continue;
            // An unrelated colliding file is retained; never silently overwrite it.
            if(target.exists())throw new IOException("A different mod uses this filename: "+target.getName());
            Files.copy(prepared.get(n).toPath(),target.toPath());verify(target,spec.getString("sha256"));
        }
    }
    private static String modId(File f) throws IOException,JSONException {
        try(JarFile jar=new JarFile(f)) {java.util.jar.JarEntry e=jar.getJarEntry("fabric.mod.json");
            if(e==null)return "";if(e.getSize()>1024*1024)throw new IOException("Mod metadata too large.");
            try(InputStream in=jar.getInputStream(e)){return new JSONObject(Tools.read(in)).optString("id","");}}
    }
    public static String[] connectArgs(String[] original,File gameDir) {
        Set<String> selectors=new HashSet<>(Arrays.asList("--server","--port","--quickPlayPath","--quickPlaySingleplayer","--quickPlayMultiplayer","--quickPlayRealms"));
        List<String> out=new ArrayList<>();
        for(int n=0;n<original.length;n++){String flag=original[n].split("=",2)[0];if(selectors.contains(flag)){
            if(!original[n].contains("=")&&n+1<original.length&&!original[n+1].startsWith("--"))n++;continue;}out.add(original[n]);}
        Collections.addAll(out,"--quickPlayMultiplayer",SERVER,"--quickPlayPath",new File(gameDir,"quickplay.json").getAbsolutePath());
        return out.toArray(new String[0]);
    }
    private static boolean allowedHost(String h) {return h.equals("github.com")||h.endsWith(".githubusercontent.com")||h.equals("cdn.modrinth.com")||h.endsWith(".forgecdn.net")||h.equals("meta.fabricmc.net");}
    private static HttpURLConnection open(String address) throws IOException {
        for(int n=0;n<6;n++) {URL u=new URL(address);if(!"https".equals(u.getProtocol())||!allowedHost(u.getHost()))throw new IOException("Untrusted download host.");
            HttpURLConnection c=(HttpURLConnection)u.openConnection();c.setInstanceFollowRedirects(false);c.setConnectTimeout(30000);c.setReadTimeout(90000);c.setRequestProperty("User-Agent","DKKF-Android/0.1.0");
            int code=c.getResponseCode();if(code>=300&&code<400){String loc=c.getHeaderField("Location");c.disconnect();if(loc==null)throw new IOException("Missing redirect.");address=new URL(u,loc).toString();continue;}
            if(code!=200){c.disconnect();throw new IOException("Download HTTP "+code);}return c;
        }throw new IOException("Too many redirects.");
    }
    private static JSONObject getJson(String url) throws Exception {HttpURLConnection c=open(url);try(InputStream in=c.getInputStream()){return new JSONObject(Tools.read(in));}finally{c.disconnect();}}
    private static void download(String url,File file,String hash) throws Exception {
        if(matches(file,hash))return;HttpURLConnection c=open(url);File temp=new File(file+".part");
        try {try(InputStream in=c.getInputStream();OutputStream out=new FileOutputStream(temp)){copy(in,out,512L*1024*1024);}
            verify(temp,hash);Files.move(temp.toPath(),file.toPath(),StandardCopyOption.REPLACE_EXISTING);
        }finally{c.disconnect();if(temp.exists())temp.delete();}
    }
    private static void copy(InputStream in,OutputStream out,long limit) throws IOException {byte[] b=new byte[65536];long size=0;int n;while((n=in.read(b))!=-1){size+=n;if(size>limit)throw new IOException("Download too large.");out.write(b,0,n);}}
    private static boolean matches(File f,String hash) throws Exception {if(!f.isFile())return false;MessageDigest d=MessageDigest.getInstance("SHA-256");try(InputStream in=new FileInputStream(f)){byte[] b=new byte[65536];int n;while((n=in.read(b))!=-1)d.update(b,0,n);}StringBuilder s=new StringBuilder();for(byte b:d.digest())s.append(String.format(Locale.ROOT,"%02x",b&255));return hash.matches("[0-9a-f]{64}")&&hash.equals(s.toString());}
    private static void verify(File f,String hash) throws Exception {if(!matches(f,hash))throw new IOException("SHA-256 verification failed.");}
    public static String safeError(Throwable e) {String m=e.getMessage();return m!=null&&m.length()<300&&!m.toLowerCase(Locale.ROOT).contains("token")?m:"Operation failed. Please try again.";}
}
