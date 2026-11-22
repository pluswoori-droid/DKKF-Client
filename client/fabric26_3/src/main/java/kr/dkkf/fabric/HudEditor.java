package kr.dkkf.fabric;

import kr.dkkf.core.HudProfile;
import com.mojang.blaze3d.platform.InputConstants;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.network.chat.Component;

/** 26.3 screen extraction and structured mouse input adapter. */
public final class HudEditor extends Screen {
    private HudProfile.Widget selected;
    private double offsetX, offsetY;
    private boolean dragging;

    public HudEditor() { super(Component.literal("DKKF HUD Editor")); }

    @Override protected void init() {
        DkkfClient.editing = true;
        int y = height - 50, cell = (width - 22) / 4;
        addRenderableWidget(Button.builder(Component.translatable("hud.dkkf.toggle"), b -> { if (selected != null) selected.enabled = !selected.enabled; }).bounds(8, y, cell, 20).build());
        addRenderableWidget(Button.builder(Component.translatable("hud.dkkf.color"), b -> { if (selected != null) selected.color = selected.color == 0x73eee0 ? 0xb69bff : selected.color == 0xb69bff ? 0xffffff : 0x73eee0; }).bounds(10 + cell, y, cell, 20).build());
        addRenderableWidget(Button.builder(Component.translatable("hud.dkkf.opacity"), b -> { if (selected != null) selected.opacity = selected.opacity <= .3f ? 1 : selected.opacity - .2f; }).bounds(12 + cell * 2, y, cell, 20).build());
        addRenderableWidget(Button.builder(Component.translatable("hud.dkkf.compact"), b -> { DkkfClient.profile.compact(); selected = null; }).bounds(14 + cell * 3, y, cell, 20).build());
        addRenderableWidget(Button.builder(Component.translatable("key.dkkf.toggle"), b -> DkkfClient.profile.visible = !DkkfClient.profile.visible).bounds(8, y + 24, (width - 20) / 2, 20).build());
        addRenderableWidget(Button.builder(Component.translatable("hud.dkkf.save"), b -> onClose()).bounds(width / 2 + 2, y + 24, (width - 20) / 2, 20).build());
    }

    @Override public void extractRenderState(GuiGraphicsExtractor graphics, int mx, int my, float delta) {
        graphics.fill(0, 0, width, height, 0xa008101c);
        graphics.centeredText(font, Component.translatable("hud.dkkf.help"), width / 2, 12, 0xff78ead8);
        DkkfClient.render(graphics, true);
        graphics.centeredText(font, Component.translatable(DkkfClient.profile.visible ? "hud.dkkf.visible" : "hud.dkkf.hidden"), width / 2, height - 77, 0xffbdcde0);
        if (selected != null) graphics.centeredText(font, selected.id + " | scale " + String.format(java.util.Locale.ROOT, "%.1f", selected.scale), width / 2, height - 65, 0xffbdcde0);
        super.extractRenderState(graphics, mx, my, delta);
    }

    @Override public boolean mouseClicked(MouseButtonEvent event, boolean doubleClick) {
        dragging = false;
        if (super.mouseClicked(event, doubleClick)) return true;
        var widgets = DkkfClient.profile.widgets;
        for (int n = widgets.size() - 1; n >= 0; n--) {
            var widget = widgets.get(n);
            int textWidth = font.width(DkkfClient.text(widget)) + 10;
            if (event.x() >= widget.x - 2 && event.x() <= widget.x + textWidth * widget.scale && event.y() >= widget.y + 24 - 2 && event.y() <= widget.y + 24 + 14 * widget.scale) {
                selected = widget;
                offsetX = event.x() - widget.x;
                offsetY = event.y() - widget.y - 24;
                dragging = event.button() == InputConstants.MOUSE_BUTTON_LEFT;
                return true;
            }
        }
        return false;
    }

    @Override public boolean mouseReleased(MouseButtonEvent event) { dragging = false; return super.mouseReleased(event); }
    @Override public boolean mouseDragged(MouseButtonEvent event, double dx, double dy) {
        if (selected != null && dragging && event.button() == InputConstants.MOUSE_BUTTON_LEFT) {
            selected.x = HudProfile.clamp((float) (event.x() - offsetX), 2, Math.max(2, width - 20));
            selected.y = HudProfile.clamp((float) (event.y() - offsetY - 24), 4, Math.max(4, height - 106));
            return true;
        }
        return super.mouseDragged(event, dx, dy);
    }
    @Override public boolean mouseScrolled(double x, double y, double horizontal, double vertical) {
        if (selected != null) { selected.scale = HudProfile.clamp(selected.scale + (float) vertical * .1f, .5f, 3); return true; }
        return super.mouseScrolled(x, y, horizontal, vertical);
    }
    @Override public void removed() {
        DkkfClient.editing = false;
        try { DkkfClient.profile.save(); } catch (Exception e) { DkkfClient.LOG.warn("Cannot save HUD settings", e); }
        super.removed();
    }
    @Override public boolean isPauseScreen() { return false; }
}
