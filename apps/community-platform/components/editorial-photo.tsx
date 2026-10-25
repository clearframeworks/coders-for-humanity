import Image from "next/image";
import { photos, type PhotoName } from "@/lib/photos";

export function EditorialPhoto({
  name,
  className = "",
  priority = false,
  sizes = "(max-width: 700px) 100vw, 50vw",
}: {
  name: PhotoName;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  const photo = photos[name];
  return (
    <div className={`editorial-photo ${className}`}>
      <Image
        src={photo.src}
        alt={photo.alt}
        fill
        sizes={sizes}
        priority={priority}
      />
      <span className="photo-caption">
        Illustrative photograph · {photo.photographer}
      </span>
    </div>
  );
}
