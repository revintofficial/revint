/**
 * PlateCamera — backwards-compatible thin wrapper around `SmoothPlate`.
 *
 * The original PlateCamera did a single-layer nearest-neighbor plate lookup,
 * which made low-cadence captures (28-90 frames over 10 seconds) step at
 * 60fps. SmoothPlate cross-blends adjacent plate frames for a synthetic-60
 * fps feel. Every existing prop shape is preserved, so any scene still
 * importing `PlateCamera` gets the cadence upgrade for free.
 */
import React from "react";
import { SmoothPlate, SmoothPlateProps } from "./SmoothPlate";

export type PlateCameraProps = SmoothPlateProps;

export const PlateCamera: React.FC<PlateCameraProps> = (props) => {
  return <SmoothPlate {...props} />;
};
