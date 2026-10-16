export const CONFIG = {
  // Movement & Physics
  SPEED_FORWARD: 20.0, // meters per second
  GRAVITY: -38.0, // m/s^2
  JUMP_VELOCITY: 14.2, // m/s initial vertical impulse
  COYOTE_TIME: 0.14, // seconds allowed to jump after leaving a ledge
  JUMP_BUFFER_TIME: 0.14, // seconds jump input will be remembered before landing
  MAX_FRAME_DELTA: 0.05, // clamp dt to avoid collision tunneling (50ms)
  
  // Player Dimensions
  PLAYER_RADIUS: 0.55,
  PLAYER_HEIGHT: 1.8,
  FALL_LIMIT_Y: -15.0, // Y coordinate below which game over triggers

  // Level & Finish
  LEVEL_LENGTH: 1000.0, // total track length
  FINISH_Z: 975.0, // Z coordinate that triggers victory
  TOTAL_CELLS: 5,
  // Meters past a roof's leading edge that still count as a razor landing.
  // Visual lip mesh and score use this same distance.
  RAZOR_MARGIN: 3.0,

  // Camera Settings
  CAMERA_OFFSET: { x: 0, y: 4.5, z: -8.5 },
  CAMERA_LOOK_OFFSET: { x: 0, y: 1.5, z: 6.0 },
  CAMERA_SMOOTH: 0.12,

  // Visual Colors
  COLORS: {
    BG_SKY: 0x070b14,
    FOG: 0x09101d,
    ROOF_SURFACE: 0x181e2b,
    ROOF_EDGE_CYAN: 0x00e5ff,
    ROOF_EDGE_AMBER: 0xff9900,
    ROOF_WALL: 0x0f141f,
    BUILDING_DISTANT: 0x0a0f18,
    WATER_TANK: 0x1b3b5a,
    CELL_GLOW: 0x00f0ff,
    CELL_CORE: 0xffea00,
    PLAYER_BODY: 0x222d3d,
    PLAYER_VISOR: 0x00e5ff,
    PLAYER_ACCENT: 0xff6600,
    RAIN: 0x7da4d4
  }
};
