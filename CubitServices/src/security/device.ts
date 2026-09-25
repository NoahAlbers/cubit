import { isIP } from 'node:net';
import { Request } from 'express';
import { localConfig } from '../dev/config';

// Labels describe the browser's self-reported agent; they are not identity proof.
export function deviceDetails(agent: string, address: string) {
  const ua = agent.slice(0, 512);
  const browsers: [string, RegExp][] = [
    ['Edge', /(?:Edg|EdgiOS|EdgA)\/([\d.]+)/],
    ['Opera', /OPR\/([\d.]+)/],
    ['Firefox', /(?:Firefox|FxiOS)\/([\d.]+)/],
    ['Chrome', /(?:Chrome|CriOS)\/([\d.]+)/],
    ['Safari', /Version\/([\d.]+).*Safari/],
  ];
  let browser = 'Unknown browser';
  for (const [name, pattern] of browsers) {
    const match = ua.match(pattern);
    if (match) {
      browser = name + ' ' + match[1].slice(0, 20);
      break;
    }
  }
  const os = /iPhone|iPad|iPod/.test(ua)
    ? 'iOS / iPadOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Macintosh|Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'Unknown OS';
  const device =
    /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))
      ? 'Tablet'
      : /Mobile|iPhone|iPod/.test(ua)
        ? 'Mobile'
        : browser === 'Unknown browser'
          ? 'Unknown device'
          : 'Computer';
  const ip = address.replace(/^::ffff:/, '');
  return { browser, os, device, ip: isIP(ip) ? ip : null };
}
export function requestDevice(req: Request) {
  // Shared demo visitors must never see another visitor's identifying metadata.
  if (localConfig.runtimeMode === 'hosted-demo')
    return { browser: 'Demo browser', os: 'Demo OS', device: 'Demo device', ip: null };
  return deviceDetails(req.get('user-agent') || '', req.ip || '');
}
