package net.kdt.pojavlaunch.dkkf;

import android.security.keystore.*;
import android.util.Base64;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Arrays;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;

/** Account files use a non-exportable, per-application Android Keystore AES key. */
public final class DkkfVault {
    private static final String ALIAS="dkkf.account.v1",PREFIX="DKKF1:";
    private static synchronized SecretKey key() throws Exception {
        KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);
        if(!store.containsAlias(ALIAS)) {
            KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setKeySize(256).build());generator.generateKey();
        }
        return (SecretKey)store.getKey(ALIAS,null);
    }
    public static String seal(String json) throws java.io.IOException {
        try {Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,key());byte[] encrypted=c.doFinal(json.getBytes(StandardCharsets.UTF_8));byte[] iv=c.getIV();byte[] data=new byte[iv.length+encrypted.length];System.arraycopy(iv,0,data,0,iv.length);System.arraycopy(encrypted,0,data,iv.length,encrypted.length);return PREFIX+Base64.encodeToString(data,Base64.NO_WRAP);}
        catch(Exception e){throw new java.io.IOException("Cannot encrypt account storage.",e);}
    }
    public static String open(String stored) throws java.io.IOException {
        if(!stored.startsWith(PREFIX))throw new java.io.IOException("Unsupported account storage format. Sign in again.");
        try {byte[] data=Base64.decode(stored.substring(PREFIX.length()),Base64.NO_WRAP);if(data.length<29)throw new IllegalArgumentException();Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Arrays.copyOfRange(data,0,12)));return new String(c.doFinal(data,12,data.length-12),StandardCharsets.UTF_8);}
        catch(Exception e){throw new java.io.IOException("Cannot decrypt account storage. Sign in again.",e);}
    }
}
