import { useEffect, useRef, useState } from "react";

const publicBase = () => (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");

const unityLoaderScriptSrc = () => `${publicBase()}unity-build/Build/unity-build.loader.js`;

const unityBuildUrl = () => `${publicBase()}unity-build/Build`;

/**
 * Loads Speed Arena WebGL from /unity-build (Vite public/). React owns STOMP; Unity calls
 * window.__speedArenaBridge.onLocalCarState(json) via SpeedArenaWebBridge.jslib.
 */
export default function UnityRaceCanvas({
  width,
  height,
  onReady,
  onLoadError,
  onLocalCarState,
}) {
  const containerRef = useRef(null);
  const unityInstanceRef = useRef(null);
  const onReadyRef = useRef(onReady);
  const onLoadErrorRef = useRef(onLoadError);
  const onLocalCarStateRef = useRef(onLocalCarState);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("boot");

  useEffect(() => {
    onReadyRef.current = onReady;
    onLoadErrorRef.current = onLoadError;
    onLocalCarStateRef.current = onLocalCarState;
  }, [onReady, onLoadError, onLocalCarState]);

  useEffect(() => {
    const bridge = (window.__speedArenaBridge = window.__speedArenaBridge || {});
    bridge.onLocalCarState = (json) => {
      onLocalCarStateRef.current?.(json);
    };
    return () => {
      if (window.__speedArenaBridge === bridge) {
        delete bridge.onLocalCarState;
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return undefined;

    const canvas = document.createElement("canvas");
    // Unity's WebGL loader may query the canvas using `document.querySelector('#' + canvas.id)`.
    // If `canvas.id` is empty, it becomes `'#'` which is an invalid selector and crashes.
    canvas.id = `unity-canvas-${Math.random().toString(36).slice(2, 10)}`;
    canvas.width = width;
    canvas.height = height;
    canvas.tabIndex = -1;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.style.display = "block";
    container.appendChild(canvas);

    const buildUrl = unityBuildUrl();
    const config = {
      arguments: [],
      dataUrl: `${buildUrl}/unity-build.data`,
      frameworkUrl: `${buildUrl}/unity-build.framework.js`,
      codeUrl: `${buildUrl}/unity-build.wasm`,
      streamingAssetsUrl: `${publicBase()}unity-build/StreamingAssets`,
      companyName: "DefaultCompany",
      productName: "Speed Arena 2D",
      productVersion: "1.0",
      showBanner: () => {},
    };

    const ensureLoader = () =>
      new Promise((resolve, reject) => {
        if (typeof window.createUnityInstance === "function") {
          resolve();
          return;
        }
        const existing = document.querySelector('script[data-speed-arena-unity-loader="1"]');
        if (existing) {
          existing.addEventListener("load", () => resolve());
          existing.addEventListener("error", () => reject(new Error("Unity loader script error")));
          return;
        }
        const s = document.createElement("script");
        s.src = unityLoaderScriptSrc();
        s.async = true;
        s.dataset.speedArenaUnityLoader = "1";
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`Failed to load ${s.src}`));
        document.head.appendChild(s);
      });

    (async () => {
      try {
        setPhase("loading");
        await ensureLoader();
        if (cancelled) return;
        const instance = await window.createUnityInstance(canvas, config, (p) => {
          if (!cancelled) setProgress(p);
        });
        if (cancelled) {
          instance?.Quit?.();
          return;
        }
        unityInstanceRef.current = instance;
        setPhase("ready");
        setProgress(1);
        onReadyRef.current?.(instance);
      } catch (e) {
        if (!cancelled) {
          setPhase("error");
          onLoadErrorRef.current?.(e);
        }
      }
    })();

    return () => {
      cancelled = true;
      const inst = unityInstanceRef.current;
      unityInstanceRef.current = null;
      if (container.contains(canvas)) container.removeChild(canvas);
      if (inst?.Quit) {
        inst.Quit().catch(() => {});
      }
    };
  }, [width, height]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {phase !== "ready" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 12,
            background: "rgba(3,3,14,0.85)",
            color: "rgba(255,255,255,0.7)",
            fontFamily: "'Orbitron', sans-serif",
            fontSize: 12,
            letterSpacing: 2,
            pointerEvents: "none",
            zIndex: 2,
          }}
        >
          {phase === "error" ? (
            <span>UNITY LOAD FAILED</span>
          ) : (
            <>
              <span>LOADING UNITY {Math.round(progress * 100)}%</span>
              <div
                style={{
                  width: Math.min(width * 0.6, 320),
                  height: 4,
                  background: "rgba(255,255,255,0.1)",
                  borderRadius: 2,
                }}
              >
                <div
                  style={{
                    width: `${progress * 100}%`,
                    height: "100%",
                    background: "#00e87a",
                    borderRadius: 2,
                    transition: "width 0.15s ease-out",
                  }}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
