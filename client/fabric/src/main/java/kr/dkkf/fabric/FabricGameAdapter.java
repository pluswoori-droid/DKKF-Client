package kr.dkkf.fabric;

import kr.dkkf.core.GameAdapter;
import net.minecraft.client.MinecraftClient;
import org.lwjgl.glfw.GLFW;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.*;

public final class FabricGameAdapter implements GameAdapter {
 private final MinecraftClient mc=MinecraftClient.getInstance();
 private final Deque<Long> clicks=new ArrayDeque<>();private boolean left=false;
 public void sample(){boolean down=GLFW.glfwGetMouseButton(mc.getWindow().getHandle(),GLFW.GLFW_MOUSE_BUTTON_LEFT)==GLFW.GLFW_PRESS;long now=System.currentTimeMillis();if(down&&!left)clicks.add(now);left=down;while(!clicks.isEmpty()&&clicks.peek()<now-1000)clicks.remove();}
 public String text(String id){var p=mc.player;return switch(id){
  case "FPS" -> mc.getCurrentFps()+" FPS";
  case "CPS" -> clicks.size()+" CPS";
  case "Ping" -> {var entry=p!=null&&mc.getNetworkHandler()!=null?mc.getNetworkHandler().getPlayerListEntry(p.getUuid()):null;yield entry==null?"Ping: —":entry.getLatency()+" ms";}
  case "Coordinates" -> p==null?"XYZ: —":String.format(Locale.ROOT,"XYZ: %.1f / %.1f / %.1f",p.getX(),p.getY(),p.getZ());
  case "Direction" -> p==null?"Direction: —":p.getHorizontalFacing().asString().toUpperCase(Locale.ROOT);
  case "Keystrokes" -> (mc.options.forwardKey.isPressed()?"[W] ":" W  ")+(mc.options.leftKey.isPressed()?"[A] ":" A  ")+(mc.options.backKey.isPressed()?"[S] ":" S  ")+(mc.options.rightKey.isPressed()?"[D] ":" D  ")+(mc.options.jumpKey.isPressed()?"[SPACE]":" SPACE");
  case "Armor Status" -> {if(p==null)yield "Armor: —";List<String> armor=new ArrayList<>();for(var stack:p.getArmorItems())if(!stack.isEmpty())armor.add(stack.getName().getString()+" "+(stack.getMaxDamage()-stack.getDamage()));yield armor.isEmpty()?"Armor: none":String.join(" | ",armor);}
  case "Potion Status" -> p==null?"Effects: —":p.getStatusEffects().stream().map(e->e.getEffectType().value().getName().getString()+" "+(e.getAmplifier()+1)+" ("+(e.getDuration()/20)+"s)").collect(Collectors.joining(" | "));
  case "Clock" -> LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm:ss"));
  case "Memory Usage" -> {Runtime r=Runtime.getRuntime();yield "RAM: "+((r.totalMemory()-r.freeMemory())/1048576)+" / "+(r.maxMemory()/1048576)+" MB";}
  default -> id;
 };}
}
