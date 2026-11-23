import { useEffect, useState } from "react";

export function ProfileAvatar({ profileImage, initials, className }) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => setImageFailed(false), [profileImage]);

  return (
    <span className={className}>
      {profileImage && !imageFailed
        ? <img src={profileImage} alt="" onError={() => setImageFailed(true)} />
        : initials}
    </span>
  );
}
