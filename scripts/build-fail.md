───(vivi@U-12RVZFT1QH80C)-[~/pixelated][master*] 
└─$ ./scripts/deploy-vps-rsync.sh
[STEP] 🚀 Deploying Pixelated Empathy to VPS via rsync
[INFO] Target: root@208.117.84.253:22
[INFO] Domain: pixelatedempathy.com
[INFO] Local dir: /home/vivi/pixelated
[INFO] Remote dir: /root/pixelated
[STEP] Testing SSH connection...
SSH connection successful
[INFO] ✅ SSH connection working
[STEP] Preparing rsync exclusions...
[INFO] ✅ Rsync exclusions prepared
[STEP] Syncing project files to VPS...
[INFO] This may take a few minutes for the initial sync...
sending incremental file list
./
pnpm-lock.yaml
      1,032,271 100%  983.48MB/s    0:00:00 (xfr#1, ir-chk=1131/1181)
stats.html
        823,591 100%   27.08MB/s    0:00:00 (xfr#2, ir-chk=1122/1181)
.astro/content.d.ts
          8,099 100%  272.73kB/s    0:00:00 (xfr#3, ir-chk=1066/1181)
.astro/types.d.ts
             76 100%    2.47kB/s    0:00:00 (xfr#4, ir-chk=1062/1181)
.astro/collections/blog.schema.json
          2,999 100%   97.62kB/s    0:00:00 (xfr#5, ir-chk=1060/1181)
.astro/collections/changelog.schema.json
          3,009 100%   97.95kB/s    0:00:00 (xfr#6, ir-chk=1059/1181)
.astro/collections/docs.schema.json
          2,999 100%   94.47kB/s    0:00:00 (xfr#7, ir-chk=1058/1181)
.astro/collections/i18n.schema.json
          2,531 100%   79.73kB/s    0:00:00 (xfr#8, ir-chk=1057/1181)
.astro/collections/pages.schema.json
          3,058 100%   93.32kB/s    0:00:00 (xfr#9, ir-chk=1056/1181)
.astro/collections/projects.schema.json
            456 100%   13.49kB/s    0:00:00 (xfr#10, ir-chk=1055/1181)
src/pages/api/ai/models.ts
          2,433 100%    3.62kB/s    0:00:00 (xfr#11, to-chk=483/18859)

sent 719,432 bytes  received 15,972 bytes  490,269.33 bytes/sec
total size is 28,673,851,892  speedup is 38,990.61
[INFO] ✅ Project files synced successfully
[STEP] Setting up VPS environment...
Pseudo-terminal will not be allocated because stdin is not a terminal.
Welcome to Ubuntu 25.04 (GNU/Linux 6.14.0-27-generic x86_64)

 * Documentation:  https://help.ubuntu.com
 * Management:     https://landscape.canonical.com
 * Support:        https://ubuntu.com/pro

 System information as of Wed Aug  6 08:51:40 PM UTC 2025

  System load:  0.0                 Processes:             187
  Usage of /:   69.6% of 157.37GB   Users logged in:       1
  Memory usage: 12%                 IPv4 address for eth0: 208.117.84.253
  Swap usage:   0%                  IPv6 address for eth0: 2607:f170:54:11::6f0

 * Strictly confined Kubernetes makes edge and IoT secure. Learn how MicroK8s
   just raised the bar for easy, resilient and secure K8s cluster deployment.

   https://ubuntu.com/engage/secure-kubernetes-at-the-edge

2 updates can be applied immediately.
To see these additional updates run: apt list --upgradable


[VPS] Setting up VPS environment...
[VPS] Updating system packages...
Hit:1 http://archive.ubuntu.com/ubuntu plucky InRelease
Get:2 http://security.ubuntu.com/ubuntu plucky-security InRelease [126 kB]
Hit:3 http://archive.ubuntu.com/ubuntu plucky-updates InRelease
Hit:4 http://archive.ubuntu.com/ubuntu plucky-backports InRelease
Hit:5 https://deb.nodesource.com/node_20.x nodistro InRelease
Hit:6 https://download.docker.com/linux/ubuntu plucky InRelease
Get:7 http://security.ubuntu.com/ubuntu plucky-security/main amd64 Components [14.7 kB]
Get:8 https://dl.cloudsmith.io/public/caddy/stable/deb/debian any-version InRelease [8,266 B]
Get:9 http://security.ubuntu.com/ubuntu plucky-security/restricted amd64 Components [212 B]
Get:10 http://security.ubuntu.com/ubuntu plucky-security/universe amd64 Components [1,684 B]
Get:11 http://security.ubuntu.com/ubuntu plucky-security/multiverse amd64 Components [212 B]
Hit:12 https://packages.microsoft.com/repos/azure-cli jammy InRelease
Hit:13 https://packages.microsoft.com/repos/code stable InRelease
Get:14 https://dl.cloudsmith.io/public/gitguardian/ggshield/deb/ubuntu plucky InRelease [2,951 B]
Fetched 154 kB in 1s (217 kB/s)
Reading package lists...
[VPS] Current Node version: /usr/bin/node
v20.19.4, upgrading to Node.js 22 via nvm...
[VPS] nvm already installed, loading existing installation...
v22.18.0 is already installed.
Now using node v22.18.0 (npm v10.9.3)
Now using node v22.18.0 (npm v10.9.3)
default -> 22 (-> v22.18.0 *)
[VPS] Node.js 22 installation completed
[VPS] ✅ VPS environment setup complete
[STEP] Setting up project on VPS...
Pseudo-terminal will not be allocated because stdin is not a terminal.
Welcome to Ubuntu 25.04 (GNU/Linux 6.14.0-27-generic x86_64)

 * Documentation:  https://help.ubuntu.com
 * Management:     https://landscape.canonical.com
 * Support:        https://ubuntu.com/pro

 System information as of Wed Aug  6 08:51:40 PM UTC 2025

  System load:  0.0                 Processes:             187
  Usage of /:   69.6% of 157.37GB   Users logged in:       1
  Memory usage: 12%                 IPv4 address for eth0: 208.117.84.253
  Swap usage:   0%                  IPv6 address for eth0: 2607:f170:54:11::6f0

 * Strictly confined Kubernetes makes edge and IoT secure. Learn how MicroK8s
   just raised the bar for easy, resilient and secure K8s cluster deployment.

   https://ubuntu.com/engage/secure-kubernetes-at-the-edge

2 updates can be applied immediately.
To see these additional updates run: apt list --upgradable


[VPS] Installing project dependencies...
 WARN  Unsupported engine: wanted: {"node":"22"} (current: {"node":"v20.19.4","pnpm":"10.14.0"})
Lockfile is up to date, resolution step is skipped
 WARN  Broken lockfile: no entry for 'astro@5.12.3(@capacitor/preferences@7.0.1(@capacitor/core@7.4.2))(@types/node@22.16.5)(@upstash/redis@1.35.1)(@vercel/kv@1.0.1)(idb-keyval@6.2.2)(ioredis@5.6.1)(jiti@2.5.0)(lightningcss@1.30.1)(rollup@4.45.1)(terser@5.43.1)(tsx@4.20.3)(typescript@5.8.3)(yaml@2.8.0)' in pnpm-lock.yaml
 ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY  The lockfile is broken! Resolution step will be performed to fix it.
 WARN  Installing a dependency from a non-existent directory: /root/pixelated/@/lib
Progress: resolved 0, reused 1, downloaded 0, added 0
Progress: resolved 212, reused 212, downloaded 0, added 0
Progress: resolved 275, reused 275, downloaded 0, added 0
Progress: resolved 776, reused 695, downloaded 0, added 0
Progress: resolved 1074, reused 946, downloaded 0, added 0
Progress: resolved 1556, reused 1405, downloaded 0, added 0
Progress: resolved 1976, reused 1831, downloaded 0, added 0
Progress: resolved 2430, reused 2286, downloaded 0, added 0
Progress: resolved 2594, reused 2450, downloaded 0, added 0
Progress: resolved 2617, reused 2474, downloaded 0, added 0
Progress: resolved 2631, reused 2488, downloaded 0, added 0
Progress: resolved 2684, reused 2541, downloaded 0, added 0
Progress: resolved 2760, reused 2617, downloaded 0, added 0
Progress: resolved 2786, reused 2642, downloaded 0, added 0
Progress: resolved 2828, reused 2684, downloaded 0, added 0
Progress: resolved 2868, reused 2725, downloaded 0, added 0
node_modules/.pnpm                       |  WARN  Cannot find resolution of astro@5.12.3(@capacitor/preferences@7.0.1(@capacitor/core@7.4.2))(@types/node@22.16.5)(@upstash/redis@1.35.1)(@vercel/kv@1.0.1)(idb-keyval@6.2.2)(ioredis@5.6.1)(jiti@2.5.0)(lightningcss@1.30.1)(rollup@4.45.1)(terser@5.43.1)(tsx@4.20.3)(typescript@5.8.3)(yaml@2.8.0) in lockfile
 WARN  1 deprecated subdependencies found: @babel/plugin-proposal-private-methods@7.18.6
Progress: resolved 2877, reused 2734, downloaded 0, added 0
Already up to date
Progress: resolved 2877, reused 2734, downloaded 0, added 0, done
 WARN  Issues with peer dependencies found
.
└─┬ mem0ai 2.1.36
  ├── ✕ unmet peer @types/pg@8.11.0: found 8.15.2
  ├── ✕ unmet peer pg@8.11.3: found 8.16.0
  └── ✕ unmet peer redis@^4.6.13: found 5.1.0

Done in 22.6s using pnpm v10.14.0
[VPS] Building project...
 WARN  Unsupported engine: wanted: {"node":"22"} (current: {"node":"v20.19.4","pnpm":"10.14.0"})

> pixelated@0.0.1 build /root/pixelated
> astro build

20:52:17 [@astrojs/node] Enabling sessions with filesystem storage
20:52:19 [content] Syncing content
20:52:19 [content] Synced content
20:52:19 [types] Generated 1.67s
20:52:19 [build] output: "server"
20:52:19 [build] mode: "server"
20:52:19 [build] directory: /root/pixelated/dist/
20:52:19 [build] adapter: @astrojs/node
20:52:19 [build] Collecting build info...
20:52:19 [build] ✓ Completed in 2.40s.
20:52:19 [build] Building server entrypoints...
20:52:24 [ERROR] [vite] ✗ Build failed in 4.66s
[vite:load-fallback] Could not load /root/pixelated/src/lib/ai/models/registry (imported by src/pages/api/ai/models.ts): ENOENT: no such file or directory, open '/root/pixelated/src/lib/ai/models/registry'
  Stack trace:
    at async open (node:internal/fs/promises:639:25)
    at async Object.handler (file:///root/pixelated/node_modules/.pnpm/vite@6.3.5_@types+node@24.1.0_jiti@2.5.0_lightningcss@1.30.1_terser@5.43.1_tsx@4.20.3_yaml@2.8.0/node_modules/vite/dist/node/chunks/dep-DBxKXgDP.js:45843:27)
    at async file:///root/pixelated/node_modules/.pnpm/rollup@4.46.2/node_modules/rollup/dist/es/shared/node-entry.js:21237:33
 ELIFECYCLE  Command failed with exit code 1.