import { useEffect, useRef, useState } from "react";
import lottie from "lottie-web";

function isRenderableImageUrl(url) {
  const u = typeof url === "string" ? url.trim() : "";
  if (!u) return false;
  if (/^https?:\/\//i.test(u)) return true;
  if (/^data:image\//i.test(u)) return true;
  return false;
}

function isVideoAnimationUrl(u) {
  return /^https?:\/\/.+\.(mp4|webm|mov)(\?|$)/i.test(String(u || "").trim());
}

function isLottieAnimationUrl(u) {
  const s = String(u || "").trim();
  if (!/^https?:\/\//i.test(s)) return false;
  if (/\.json(\?|$)/i.test(s)) return true;
  if (/lottie/i.test(s)) return true;
  return false;
}

/**
 * Detail hero: Lottie JSON (Gift Asset `lottie_anim`), muted looping video, or static image.
 * Listing cards should omit `animationUrl` so the Mini App does not run many players at once.
 */
export default function GiftAnimatedHero({ animationUrl, posterUrl, alt }) {
  const lottieHostRef = useRef(null);
  const [preferRaster, setPreferRaster] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [lottieReady, setLottieReady] = useState(false);

  const anim = typeof animationUrl === "string" ? animationUrl.trim() : "";
  const poster = typeof posterUrl === "string" ? posterUrl.trim() : "";
  const rasterUrl = isRenderableImageUrl(poster) ? poster : "";

  const reduceMotion =
    typeof window !== "undefined" &&
    Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);

  useEffect(() => {
    setPreferRaster(false);
    setImgFailed(false);
    setImgLoaded(false);
    setLottieReady(false);
  }, [anim, poster]);

  useEffect(() => {
    if (!anim || preferRaster || reduceMotion) return;
    if (isVideoAnimationUrl(anim) || !isLottieAnimationUrl(anim)) return;
    const host = lottieHostRef.current;
    if (!host) return;

    let instance;
    let cancelled = false;
    const fail = () => {
      if (cancelled) return;
      setPreferRaster(true);
      try {
        instance?.destroy();
      } catch {
        /* ignore */
      }
    };

    try {
      instance = lottie.loadAnimation({
        container: host,
        renderer: "svg",
        loop: true,
        autoplay: true,
        path: anim,
        rendererSettings: {
          preserveAspectRatio: "xMidYMid slice",
          className: "giftLottieSvg",
          hideOnTransparent: true,
        },
      });
    } catch {
      fail();
      return () => {
        cancelled = true;
      };
    }

    instance.addEventListener("DOMLoaded", () => {
      if (!cancelled) setLottieReady(true);
    });
    instance.addEventListener("data_failed", fail);
    instance.addEventListener("error", fail);

    const watchdog = setTimeout(() => {
      if (cancelled) return;
      try {
        if (!instance?.isLoaded) fail();
      } catch {
        fail();
      }
    }, 14_000);

    return () => {
      cancelled = true;
      clearTimeout(watchdog);
      try {
        instance?.removeEventListener("data_failed", fail);
        instance?.removeEventListener("error", fail);
        instance?.destroy();
      } catch {
        /* ignore */
      }
    };
  }, [anim, preferRaster, reduceMotion]);

  const useAnim = Boolean(anim && !preferRaster && !reduceMotion);
  const showVideo = useAnim && isVideoAnimationUrl(anim);
  const showLottie = useAnim && isLottieAnimationUrl(anim);

  if (showVideo) {
    return (
      <div className="giftAnimHeroRoot">
        <video
          className={`giftAnimVideo nftHeroImg ${imgLoaded ? "nftHeroImg--loaded" : ""}`}
          src={anim}
          poster={rasterUrl || undefined}
          autoPlay
          muted
          playsInline
          loop
          controls={false}
          disablePictureInPicture
          onLoadedData={() => setImgLoaded(true)}
          onError={() => setPreferRaster(true)}
        />
      </div>
    );
  }

  const fallback = (
    <div className="nftCardFb" style={{ position: "absolute", inset: 0 }}>
      <span className="nftCardFbName">{alt}</span>
    </div>
  );

  return (
    <div className="giftAnimHeroRoot">
      {showLottie ? (
        <>
          {rasterUrl ? (
            <img
              src={rasterUrl}
              alt={alt}
              width={640}
              height={640}
              className={`nftHeroImg giftAnimPoster ${imgLoaded ? "nftHeroImg--loaded" : ""} ${
                lottieReady ? "giftAnimPoster--hidden" : ""
              }`}
              loading="eager"
              decoding="async"
              referrerPolicy="no-referrer"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgFailed(true)}
            />
          ) : null}
          <div ref={lottieHostRef} className="giftLottieHost" aria-hidden="true" />
        </>
      ) : rasterUrl && !imgFailed ? (
        <img
          src={rasterUrl}
          alt={alt}
          width={640}
          height={640}
          className={`nftHeroImg giftAnimPoster ${imgLoaded ? "nftHeroImg--loaded" : ""}`}
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setImgLoaded(true)}
          onError={() => {
            setImgFailed(true);
            setImgLoaded(false);
          }}
        />
      ) : (
        fallback
      )}
    </div>
  );
}
