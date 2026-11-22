package kr.dkkf.bridge.fabric;

import kr.dkkf.bridge.Protocol;
import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.resources.Identifier;

final class BridgePayloads {
    record Control(byte[] bytes) implements CustomPacketPayload {
        static final Type<Control> TYPE=new Type<>(Identifier.parse(Protocol.CONTROL));
        static final StreamCodec<RegistryFriendlyByteBuf,Control> CODEC=StreamCodec.of((buf,value)->buf.writeBytes(value.bytes()),buf->new Control(read(buf)));
        @Override public Type<? extends CustomPacketPayload> type(){return TYPE;}
    }
    record State(byte[] bytes) implements CustomPacketPayload {
        static final Type<State> TYPE=new Type<>(Identifier.parse(Protocol.STATE));
        static final StreamCodec<RegistryFriendlyByteBuf,State> CODEC=StreamCodec.of((buf,value)->buf.writeBytes(value.bytes()),buf->new State(read(buf)));
        @Override public Type<? extends CustomPacketPayload> type(){return TYPE;}
    }
    private static byte[] read(RegistryFriendlyByteBuf buf){int size=buf.readableBytes();if(size>Protocol.MAX_BYTES)throw new IllegalArgumentException("Oversized DKKF bridge payload");var bytes=new byte[size];buf.readBytes(bytes);return bytes;}
}
