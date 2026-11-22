package kr.dkkf.fabric;

import kr.dkkf.core.GameAdapter;
import net.minecraft.client.Minecraft;
import net.minecraft.network.chat.Component;
import net.minecraft.world.entity.EquipmentSlot;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/** Minecraft 26.3 uses Mojang's unobfuscated API, not the old Yarn names. */
public final class FabricGameAdapter implements GameAdapter {
    private final Minecraft mc = Minecraft.getInstance();
    private final Deque<Long> clicks = new ArrayDeque<>();
    private boolean left;

    void sample() {
        boolean down = mc.mouseHandler.isLeftPressed();
        long now = System.nanoTime();
        if (down && !left) clicks.add(now);
        left = down;
        while (!clicks.isEmpty() && clicks.peek() < now - 1_000_000_000L) clicks.remove();
    }

    @Override
    public String text(String id) {
        var player = mc.player;
        return switch (id) {
            case "FPS" -> mc.getFps() + " FPS";
            case "CPS" -> clicks.size() + " CPS";
            case "Ping" -> {
                var info = player != null && mc.getConnection() != null ? mc.getConnection().getPlayerInfo(player.getUUID()) : null;
                yield info == null ? "Ping: —" : info.getLatency() + " ms";
            }
            case "Coordinates" -> player == null ? "XYZ: —" : String.format(Locale.ROOT, "XYZ: %.1f / %.1f / %.1f", player.getX(), player.getY(), player.getZ());
            case "Direction" -> player == null ? "Direction: —" : player.getDirection().getSerializedName().toUpperCase(Locale.ROOT);
            case "Keystrokes" -> (mc.options.keyUp.isDown() ? "[W] " : " W  ") + (mc.options.keyLeft.isDown() ? "[A] " : " A  ") + (mc.options.keyDown.isDown() ? "[S] " : " S  ") + (mc.options.keyRight.isDown() ? "[D] " : " D  ") + (mc.options.keyJump.isDown() ? "[SPACE]" : " SPACE");
            case "Armor Status" -> {
                if (player == null) yield "Armor: —";
                List<String> armor = new ArrayList<>();
                for (var slot : List.of(EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET)) {
                    var stack = player.getItemBySlot(slot);
                    if (!stack.isEmpty()) armor.add(stack.getHoverName().getString() + " " + (stack.getMaxDamage() - stack.getDamageValue()));
                }
                yield armor.isEmpty() ? "Armor: none" : String.join(" | ", armor);
            }
            case "Potion Status" -> player == null ? "Effects: —" : player.getActiveEffects().stream().map(effect -> Component.translatable(effect.getEffect().value().getDescriptionId()).getString() + " " + (effect.getAmplifier() + 1) + " (" + (effect.getDuration() / 20) + "s)").collect(Collectors.joining(" | "));
            case "Clock" -> LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm:ss"));
            case "Memory Usage" -> { Runtime runtime = Runtime.getRuntime(); yield "RAM: " + ((runtime.totalMemory() - runtime.freeMemory()) / 1048576) + " / " + (runtime.maxMemory() / 1048576) + " MB"; }
            default -> id;
        };
    }
}
