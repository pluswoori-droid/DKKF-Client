package kr.dkkf.bridge.fabric;

import com.mojang.blaze3d.platform.InputConstants;
import kr.dkkf.bridge.Protocol;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
import net.fabricmc.fabric.api.client.networking.v1.*;
import net.fabricmc.fabric.api.networking.v1.PayloadTypeRegistry;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.resources.Identifier;

public final class BridgeClient implements ClientModInitializer {
    static final Set<String> KNOWN=Set.of("flight","speed","high_jump","step","reach","fast_break","no_fall","anti_knockback","water_speed","low_gravity","night_vision","water_breathing","no_fire","no_hunger","regeneration","auto_sprint","auto_attack","trigger_bot");
    static List<Protocol.Feature> features=List.of();
    static long nonce,token,lastSeen,lastHello,lastToggle;
    static boolean connected(){return token!=0&&System.currentTimeMillis()-lastSeen<6000;}
    static void reset(){features=List.of();nonce=ThreadLocalRandom.current().nextLong();token=0;lastSeen=0;lastHello=0;lastToggle=0;}
    static void accept(byte[] bytes){
        try{var message=Protocol.decode(bytes);if(message.op()!=Protocol.SNAPSHOT||message.nonce()!=nonce||message.token()==0)return;
            features=message.features().stream().filter(f->KNOWN.contains(f.id())).toList();token=message.token();lastSeen=System.currentTimeMillis();
        }catch(java.io.IOException ignored){}
    }
    static void toggle(String id,boolean enabled){
        long now=System.currentTimeMillis();if(!connected()||!KNOWN.contains(id)||now-lastToggle<200||!ClientPlayNetworking.canSend(BridgePayloads.Control.TYPE))return;
        lastToggle=now;ClientPlayNetworking.send(new BridgePayloads.Control(Protocol.toggle(nonce,token,id,enabled)));
    }
    @Override public void onInitializeClient(){
        reset();
        PayloadTypeRegistry.serverboundPlay().register(BridgePayloads.Control.TYPE,BridgePayloads.Control.CODEC);
        PayloadTypeRegistry.clientboundPlay().register(BridgePayloads.State.TYPE,BridgePayloads.State.CODEC);
        ClientPlayNetworking.registerGlobalReceiver(BridgePayloads.State.TYPE,(payload,context)->context.client().execute(()->accept(payload.bytes())));
        ClientPlayConnectionEvents.JOIN.register((handler,sender,client)->reset());
        ClientPlayConnectionEvents.DISCONNECT.register((handler,client)->reset());
        var category=KeyMapping.Category.register(Identifier.fromNamespaceAndPath("dkkf_bridge","server"));
        var menu=KeyMappingHelper.registerKeyMapping(new KeyMapping("key.dkkf_bridge.menu",InputConstants.Type.KEYBOARD,InputConstants.KEY_F10,category));
        ClientTickEvents.END_CLIENT_TICK.register(client->{
            while(menu.consumeClick())client.setScreenAndShow(new BridgeScreen());
            if(client.getConnection()==null||client.player==null){if(token!=0)reset();return;}
            long now=System.currentTimeMillis();
            if(token!=0&&now-lastSeen>6000)reset();
            if(now-lastHello>2000&&ClientPlayNetworking.canSend(BridgePayloads.Control.TYPE)){lastHello=now;ClientPlayNetworking.send(new BridgePayloads.Control(Protocol.hello(nonce)));}
            if(connected()&&features.stream().anyMatch(f->f.id().equals("auto_sprint")&&f.enabled())&&client.options.keyUp.isDown()&&!client.player.isCrouching()&&!client.player.isUsingItem()&&!client.player.horizontalCollision)client.player.setSprinting(true);
        });
    }
}
