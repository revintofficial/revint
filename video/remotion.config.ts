import { Config } from "@remotion/cli/config";

/**
 * Render profile switch. Set `RENDER_PROFILE=master` for high-quality
 * master-grade renders (PNG intermediates, CRF 16), anything else uses the
 * fast JPEG + CRF 20 preset for preview / studio iteration.
 *
 *   RENDER_PROFILE=master npm run render:ad
 */
const isMaster = process.env.RENDER_PROFILE === "master";

Config.setVideoImageFormat(isMaster ? "png" : "jpeg");
Config.setJpegQuality(isMaster ? 100 : 85);
Config.setOverwriteOutput(true);
Config.setConcurrency(8);
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(isMaster ? 16 : 20);
Config.setChromiumOpenGlRenderer("angle");

// Public folder is where Remotion serves static assets from.
// We point it at ../captures so PNG sequences from Steel can be loaded
// via staticFile() in scene components.
Config.setPublicDir("../captures");
