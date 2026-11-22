# Version adapters

`GameAdapter` in `common` contains no Minecraft or loader classes. `FabricGameAdapter` currently targets Minecraft 1.21.1 only. Add a new source set / module per incompatible Minecraft API; never mark all game versions as supported by the HUD artifact.
