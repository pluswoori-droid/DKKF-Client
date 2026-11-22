package net.kdt.pojavlaunch.dkkf;

import android.content.Intent;
import android.net.Uri;
import android.os.*;
import android.widget.*;
import androidx.appcompat.app.AppCompatActivity;
import net.kdt.pojavlaunch.*;
import net.kdt.pojavlaunch.authenticator.microsoft.MicrosoftBackgroundLogin;
import org.json.JSONObject;
import java.net.URI;
import java.util.concurrent.atomic.AtomicBoolean;

public final class DkkfLoginActivity extends AppCompatActivity {
    private final AtomicBoolean canceled=new AtomicBoolean();
    private TextView status,code;
    private Button browser;
    private String url;
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        ScrollView scroll=new ScrollView(this);LinearLayout content=new LinearLayout(this);content.setOrientation(LinearLayout.VERTICAL);
        int pad=(int)(24*getResources().getDisplayMetrics().density);content.setPadding(pad,pad,pad,pad);scroll.addView(content);setContentView(scroll);
        TextView title=new TextView(this);title.setText("Dkkf Launcher · Android Preview");title.setTextSize(25);content.addView(title);
        status=new TextView(this);status.setText(R.string.dkkf_login_wait);status.setPadding(0,pad,0,pad);content.addView(status);
        code=new TextView(this);code.setTextSize(30);code.setTextIsSelectable(true);content.addView(code);
        browser=new Button(this);browser.setText(R.string.dkkf_browser);browser.setEnabled(false);browser.setOnClickListener(v->startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url))));content.addView(browser);
        Button close=new Button(this);close.setText(android.R.string.cancel);close.setOnClickListener(v->{canceled.set(true);finish();});content.addView(close);
        TextView pageNotice=new TextView(this);pageNotice.setText(R.string.dkkf_page_size_notice);pageNotice.setPadding(0,pad,0,0);content.addView(pageNotice);
        TextView disclaimer=new TextView(this);disclaimer.setText(R.string.dkkf_disclaimer);disclaimer.setPadding(0,pad,0,0);content.addView(disclaimer);
        PojavApplication.sExecutorService.execute(()->{
            try {
                JSONObject device=DkkfOAuth.deviceCode();String verify=device.getString("verification_uri");URI uri=new URI(verify);
                if(!"https".equals(uri.getScheme())||!("microsoft.com".equals(uri.getHost())||"www.microsoft.com".equals(uri.getHost())||"login.microsoftonline.com".equals(uri.getHost())))throw new IllegalStateException("Invalid verification page.");
                url=verify;int interval=Math.max(1,device.optInt("interval",5));
                long expiry=SystemClock.elapsedRealtime()+device.getLong("expires_in")*1000;
                runOnUiThread(()->{if(canceled.get())return;code.setText(device.optString("user_code"));status.setText(R.string.dkkf_device_help);browser.setEnabled(true);});
                while(!canceled.get()&&SystemClock.elapsedRealtime()<expiry) {
                    Thread.sleep(interval*1000L);if(canceled.get())return;
                    JSONObject token=DkkfOAuth.poll(device.getString("device_code"));String error=token.optString("error","");
                    if("slow_down".equals(error)){interval+=5;continue;}if("authorization_pending".equals(error))continue;
                    String access=token.getString("access_token"),refresh=token.getString("refresh_token");
                    if(canceled.get())return;
                    runOnUiThread(()->{status.setText(R.string.dkkf_login_wait);browser.setEnabled(false);});
                    MicrosoftBackgroundLogin login=new MicrosoftBackgroundLogin(false,access);login.msRefreshToken=refresh;
                    login.performLogin(null,account->{
                        if(canceled.get())return;
                        PojavProfile.setCurrentProfile(this,account.username);
                        startActivity(new Intent(this,LauncherActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP));finish();
                    },this::showError);
                    return;
                }
                if(!canceled.get())showError(new IllegalStateException(getString(R.string.dkkf_expired)));
            } catch(Exception error){showError(error);}
        });
    }
    private void showError(Throwable error){runOnUiThread(()->{if(!canceled.get()){status.setText(DkkfSupport.safeError(error));browser.setEnabled(false);}});}
    @Override public void onDestroy(){canceled.set(true);super.onDestroy();}
}
