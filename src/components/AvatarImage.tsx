import { useState, type ImgHTMLAttributes } from 'react';
import { avatarSources } from '../services/avatarSources';

function AvatarAttempt(props: ImgHTMLAttributes<HTMLImageElement>) {
  const sources = avatarSources(props.src);
  const [attempt, setAttempt] = useState(0);
  return <img {...props} src={sources[attempt]} srcSet={attempt ? undefined : props.srcSet}
    onError={event => { if (attempt < sources.length - 1) setAttempt(attempt + 1); props.onError?.(event); }}/>;
}
export function AvatarImage(props: ImgHTMLAttributes<HTMLImageElement>) {
  return <AvatarAttempt key={props.src} {...props}/>;
}
