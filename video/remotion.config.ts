import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setConcurrency(8);
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(18);
Config.setChromiumOpenGlRenderer("angle");

// Public folder is where Remotion serves static assets from.
// We point it at ../captures so PNG sequences from Steel can be loaded
// via staticFile() in scene components.
Config.setPublicDir("../captures");
