import React from "react";
import { Composition } from "remotion";
import { Video } from "./Video";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="ArcanaPromo"
    component={Video}
    durationInFrames={900}
    fps={30}
    width={1920}
    height={1080}
  />
);
