package kr.dkkf.fabric;

import com.mojang.blaze3d.platform.InputConstants;
import kr.dkkf.core.HudProfile;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.hud.VanillaHudElements;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.resources.Identifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class DkkfClient implements ClientModInitializer {
    static final Logger LOG = LoggerFactory.getLogger("DKKF");
    static HudProfile profile;
    static FabricGameAdapter adapter;
    static boolean editing;

    @Override
    public void onInitializeClient() {
        profile = new HudProfile(FabricLoader.getInstance().getConfigDir().resolve("dkkf/profiles"));
        adapter = new FabricGameAdapter();
        try { profile.load("default"); } catch (Exception e) { LOG.warn("Cannot load HUD profile", e); }
        var category = KeyMapping.Category.register(Identifier.fromNamespaceAndPath("dkkf_core", "hud"));
        var editor = KeyMappingHelper.registerKeyMapping(new KeyMapping("key.dkkf.editor", InputConstants.Type.KEYBOARD, InputConstants.KEY_F8, category));
        var profiles = KeyMappingHelper.registerKeyMapping(new KeyMapping("key.dkkf.profile", InputConstants.Type.KEYBOARD, InputConstants.KEY_F9, category));
        var toggle = KeyMappingHelper.registerKeyMapping(new KeyMapping("key.dkkf.toggle", InputConstants.Type.KEYBOARD, InputConstants.KEY_F7, category));
        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            while (toggle.consumeClick()) {
                profile.visible = !profile.visible;
                try { profile.save(); } catch (Exception e) { LOG.warn("Cannot save HUD visibility", e); }
            }
            while (editor.consumeClick()) if (!editing) client.setScreenAndShow(new HudEditor());
            while (profiles.consumeClick()) {
                try {
                    profile.save();
                    profile.load(switch (profile.name) { case "default" -> "pvp"; case "pvp" -> "minimal"; default -> "default"; });
                } catch (Exception e) { LOG.warn("Cannot switch HUD profile", e); }
            }
        });
        HudElementRegistry.attachElementBefore(VanillaHudElements.CHAT, Identifier.fromNamespaceAndPath("dkkf_core", "hud"), (graphics, delta) -> {
            adapter.sample();
            var mc = Minecraft.getInstance();
            if (!editing && profile.visible && !mc.gui.hud.isHidden() && mc.gui.screen() == null && mc.player != null) render(graphics, false);
        });
        LOG.info("DKKF HUD 0.3.1 initialized for Minecraft 26.3 Fabric");
    }

    static String text(HudProfile.Widget widget) {
        String value = adapter.text(widget.id);
        return value.isEmpty() ? widget.id + ": none" : value;
    }

    static void render(GuiGraphicsExtractor graphics, boolean editor) {
        var mc = Minecraft.getInstance();
        for (var widget : profile.widgets) {
            if (!widget.enabled && !editor) continue;
            String text = text(widget);
            int availableWidth = Math.max(20, graphics.guiWidth() - 8);
            int textWidth = mc.font.width(text) + 8;
            float x = HudProfile.clamp(widget.x, 2, Math.max(2, graphics.guiWidth() - Math.min(availableWidth, textWidth * widget.scale)));
            float y = HudProfile.clamp(widget.y + (editor ? 24 : 0), editor ? 28 : 2, Math.max(28, graphics.guiHeight() - (editor ? 82 : 14 * widget.scale)));
            if (editor) { widget.x = x; widget.y = y - 24; }
            graphics.pose().pushMatrix();
            graphics.pose().translate(x, y);
            graphics.pose().scale(widget.scale, widget.scale);
            graphics.fill(-2, -2, textWidth, 12, ((int) (widget.opacity * (editor ? 180 : 45)) << 24) | 0x08131f);
            graphics.text(mc.font, text, 2, 0, ((int) (widget.opacity * 255) << 24) | widget.color, true);
            if (editor) graphics.outline(-2, -2, textWidth + 2, 14, widget.enabled ? 0xff52d8c9 : 0xff764454);
            graphics.pose().popMatrix();
        }
    }
}
