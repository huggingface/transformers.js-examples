import { useState, useEffect, useRef } from "react";

export default function Image({
  alt,
  className,
  style,
  blurDataURL,
  src,
  width,
  height,
  objectFit,
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 },
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      if (imgRef.current) {
        observer.unobserve(imgRef.current);
      }
    };
  }, []);

  const aspectRatio = width && height ? (height / width) * 100 : null;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        paddingTop: aspectRatio ? `${aspectRatio}%` : "auto",
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
      className={className}
      ref={imgRef}
    >
      {/* Placeholder Blur Image */}
      {!isLoaded && blurDataURL && (
        <img
          src={blurDataURL}
          alt={alt}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            filter: "blur(20px)",
            transform: "scale(1.1)",
          }}
        />
      )}
      {/* Actual Image */}
      {isVisible && (
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          style={{
            display: isLoaded ? "block" : "none",
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: objectFit,
          }}
          onLoad={() => setIsLoaded(true)}
        />
      )}
    </div>
  );
}
