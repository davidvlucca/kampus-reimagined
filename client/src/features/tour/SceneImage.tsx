import { useState } from "react";
import { cn } from "../../lib/cn.ts";

/** Cenário a ocupar a área; aparece com fade quando carrega (sem fade com reduced motion, via CSS global). */
export function SceneImage({ scene, alt, fade = true }: { scene: string; alt: string; fade?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      src={scene}
      alt={alt}
      decoding="async"
      onLoad={() => setLoaded(true)}
      onError={() => setLoaded(true)}
      className={cn(
        "absolute inset-0 size-full object-cover",
        fade && "transition-opacity duration-700 ease-out",
        fade && !loaded ? "opacity-0" : "opacity-100",
      )}
    />
  );
}
