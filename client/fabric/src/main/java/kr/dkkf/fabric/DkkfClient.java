package kr.dkkf.fabric;

import kr.dkkf.core.HudProfile;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import org.lwjgl.glfw.GLFW;
import org.slf4j.LoggerFactory;

public final class DkkfClient implements ClientModInitializer {
 public static HudProfile profile;
 public static final FabricGameAdapter adapter=new FabricGameAdapter();
 public void onInitializeClient(){profile=new HudProfile(FabricLoader.getInstance().getConfigDir().resolve("dkkf/profiles"));try{profile.load("default");}catch(Exception e){LoggerFactory.getLogger("DKKF").warn("Cannot load HUD profile",e);}
  KeyBinding editor=KeyBindingHelper.registerKeyBinding(new KeyBinding("DKKF HUD Editor",InputUtil.Type.KEYSYM,GLFW.GLFW_KEY_F8,"DKKF Client"));
  KeyBinding profiles=KeyBindingHelper.registerKeyBinding(new KeyBinding("DKKF Cycle Profile",InputUtil.Type.KEYSYM,GLFW.GLFW_KEY_F9,"DKKF Client"));
  ClientTickEvents.END_CLIENT_TICK.register(client->{while(editor.wasPressed())client.setScreen(new HudEditor());while(profiles.wasPressed()){try{profile.save();profile.load(switch(profile.name){case "default"->"pvp";case "pvp"->"minimal";default->"default";});}catch(Exception e){LoggerFactory.getLogger("DKKF").warn("Cannot save profile",e);}}});
  HudRenderCallback.EVENT.register((context,tick)->{adapter.sample();var mc=MinecraftClient.getInstance();if(mc.options.hudHidden||mc.currentScreen instanceof HudEditor)return;render(context,false);});
 }
 public static void render(DrawContext context,boolean editing){var mc=MinecraftClient.getInstance();for(var w:profile.widgets){if(!w.enabled&&!editing)continue;String text=adapter.text(w.id);if(text.isEmpty())text=w.id+": none";float x=Math.min(w.x,mc.getWindow().getScaledWidth()-20),y=Math.min(w.y,mc.getWindow().getScaledHeight()-12);context.getMatrices().push();context.getMatrices().translate(Math.max(0,x),Math.max(0,y),0);context.getMatrices().scale(w.scale,w.scale,1);int width=mc.textRenderer.getWidth(text)+8;context.fill(-2,-2,width,12,((int)(w.opacity*180)<<24)|0x08131f);int alpha=(int)(w.opacity*255);context.drawTextWithShadow(mc.textRenderer,text,2,0,(alpha<<24)|w.color);if(editing)context.drawBorder(-2,-2,width+2,14,w.enabled?0xff52d8c9:0xff764454);context.getMatrices().pop();}}
}
