package net.kdt.pojavlaunch.dkkf;

import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Public-client device flow. No secret, password WebView, or token/body logging. */
public final class DkkfOAuth {
    private static final String AUTH="https://login.microsoftonline.com/consumers/oauth2/v2.0/";
    public static JSONObject deviceCode() throws Exception {return form("devicecode","client_id",DkkfSupport.clientId(),"scope","XboxLive.signin offline_access");}
    public static JSONObject poll(String code) throws Exception {return form("token","client_id",DkkfSupport.clientId(),"grant_type","urn:ietf:params:oauth:grant-type:device_code","device_code",code);}
    public static JSONObject refresh(String token) throws Exception {return form("token","client_id",DkkfSupport.clientId(),"grant_type","refresh_token","refresh_token",token,"scope","XboxLive.signin offline_access");}
    private static JSONObject form(String path,String... values) throws Exception {
        StringBuilder body=new StringBuilder();for(int n=0;n<values.length;n+=2){if(n!=0)body.append('&');body.append(URLEncoder.encode(values[n],"UTF-8")).append('=').append(URLEncoder.encode(values[n+1],"UTF-8"));}
        byte[] bytes=body.toString().getBytes(StandardCharsets.UTF_8);
        HttpURLConnection c=(HttpURLConnection)new URL(AUTH+path).openConnection();
        c.setInstanceFollowRedirects(false);c.setConnectTimeout(30000);c.setReadTimeout(30000);
        c.setRequestMethod("POST");c.setDoOutput(true);c.setRequestProperty("Content-Type","application/x-www-form-urlencoded");c.setFixedLengthStreamingMode(bytes.length);
        try {
            try(OutputStream out=c.getOutputStream()){out.write(bytes);}
            int status=c.getResponseCode();InputStream stream=status>=200&&status<300?c.getInputStream():c.getErrorStream();
            if(stream==null)throw new IOException("Microsoft HTTP "+status);
            JSONObject data;try(InputStream in=stream){ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1){if(out.size()+n>1024*1024)throw new IOException("Authentication response too large.");out.write(b,0,n);}data=new JSONObject(out.toString("UTF-8"));}
            if(status>=200&&status<300)return data;
            String error=data.optString("error","");
            if("authorization_pending".equals(error)||"slow_down".equals(error))return data;
            if(!error.matches("[a-z_]{1,60}"))error="oauth_error";
            throw new IOException("Microsoft HTTP "+status+" ("+error+")");
        }finally{c.disconnect();}
    }
}
