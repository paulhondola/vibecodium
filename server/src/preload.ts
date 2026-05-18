import { plugin } from "bun";

// Bun on WSL2 panics (instead of throwing) when native Node addons call
// uv_version_string, which Bun doesn't support on Linux yet.
// Affected modules pulled in by ssh2 (transitive dep of dockerode):
//   - sshcrypto.node   — ssh2's native crypto (has pure-JS fallback)
//   - cpufeatures.node — cpu-features (has pure-JS fallback)
// This plugin intercepts all .node files and returns empty stubs so the
// try/catch fallbacks in those packages engage normally.
// See: https://github.com/oven-sh/bun/issues/18546
plugin({
  name: "stub-broken-native-modules",
  setup(build) {
    build.onResolve({ filter: /\.(node)$/ }, (args) => ({
      path: args.path,
      namespace: "stub-native",
    }));
    build.onLoad({ filter: /.*/, namespace: "stub-native" }, () => ({
      contents: "module.exports = {};",
      loader: "js",
    }));
  },
});
