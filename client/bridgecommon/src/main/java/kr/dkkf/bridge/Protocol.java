package kr.dkkf.bridge;

import java.io.*;
import java.util.*;

public final class Protocol {
    public static final String CONTROL = "dkkf:control", STATE = "dkkf:state";
    public static final int MAX_BYTES = 8192, MAGIC = 0x444b4b46, VERSION = 1;
    public static final int HELLO = 0, TOGGLE = 1, SNAPSHOT = 2;
    public record Feature(String id, String label, boolean enabled) {}
    public record Message(int op, long nonce, long token, String feature, boolean enabled, List<Feature> features) {}
    private Protocol() {}
    public static byte[] hello(long nonce) { return encode(new Message(HELLO,nonce,0,"",false,List.of())); }
    public static byte[] toggle(long nonce,long token,String feature,boolean enabled) { return encode(new Message(TOGGLE,nonce,token,feature,enabled,List.of())); }
    public static byte[] snapshot(long nonce,long token,List<Feature> features) { return encode(new Message(SNAPSHOT,nonce,token,"",false,features)); }
    private static byte[] encode(Message m) {
        try {
            var bytes=new ByteArrayOutputStream();var out=new DataOutputStream(bytes);
            out.writeInt(MAGIC);out.writeByte(VERSION);out.writeByte(m.op());out.writeLong(m.nonce());
            if(m.op()!=HELLO)out.writeLong(m.token());
            if(m.op()==TOGGLE){out.writeUTF(m.feature());out.writeBoolean(m.enabled());}
            if(m.op()==SNAPSHOT){if(m.features().size()>64)throw new IllegalArgumentException("Too many capabilities");out.writeByte(m.features().size());for(var f:m.features()){out.writeUTF(f.id());out.writeUTF(f.label());out.writeBoolean(f.enabled());}}
            out.flush();if(bytes.size()>MAX_BYTES)throw new IllegalArgumentException("Oversized payload");return bytes.toByteArray();
        }catch(IOException e){throw new IllegalStateException(e);}
    }
    public static Message decode(byte[] bytes) throws IOException {
        if(bytes.length>MAX_BYTES)throw new IOException("Oversized payload");
        var in=new DataInputStream(new ByteArrayInputStream(bytes));
        if(in.readInt()!=MAGIC||in.readUnsignedByte()!=VERSION)throw new IOException("Unsupported protocol");
        int op=in.readUnsignedByte();if(op>SNAPSHOT)throw new IOException("Unknown operation");
        long nonce=in.readLong(),token=op==HELLO?0:in.readLong();String feature="";boolean enabled=false;var features=new ArrayList<Feature>();
        if(op==TOGGLE){feature=in.readUTF();enabled=in.readBoolean();if(!feature.matches("[a-z_]{1,40}"))throw new IOException("Invalid feature");}
        if(op==SNAPSHOT){int count=in.readUnsignedByte();if(count>64)throw new IOException("Too many capabilities");var seen=new HashSet<String>();for(int n=0;n<count;n++){var id=in.readUTF();var label=in.readUTF();boolean active=in.readBoolean();if(!id.matches("[a-z_]{1,40}")||label.length()>80||!seen.add(id))throw new IOException("Invalid capability");features.add(new Feature(id,label,active));}}
        if(in.available()!=0)throw new IOException("Trailing payload data");return new Message(op,nonce,token,feature,enabled,List.copyOf(features));
    }
}
