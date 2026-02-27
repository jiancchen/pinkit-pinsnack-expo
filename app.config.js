const VARIANT_CONFIG = {
  dev: {
    nameSuffix: " (Dev)",
    bundleSuffix: ".dev",
    schemeSuffix: "-dev",
  },
  preview: {
    nameSuffix: " (Preview)",
    bundleSuffix: ".preview",
    schemeSuffix: "-preview",
  },
  production: {
    nameSuffix: "",
    bundleSuffix: "",
    schemeSuffix: "",
  },
};

module.exports = ({ config }) => {
  const variant = process.env.APP_VARIANT || "production";
  const variantConfig = VARIANT_CONFIG[variant] || VARIANT_CONFIG.production;

  const baseName = (config.name || "App").replace(/ \((Dev|Preview)\)$/, "");
  const baseBundleIdentifier = (config.ios?.bundleIdentifier || "").replace(
    /\.(dev|preview)$/,
    ""
  );
  const baseAndroidPackage = (config.android?.package || "").replace(
    /\.(dev|preview)$/,
    ""
  );
  const baseScheme =
    typeof config.scheme === "string"
      ? config.scheme.replace(/-(dev|preview)$/, "")
      : "app";

  const bundleIdentifier = `${baseBundleIdentifier}${variantConfig.bundleSuffix}`;
  const androidPackage = `${baseAndroidPackage}${variantConfig.bundleSuffix}`;
  const scheme = `${baseScheme}${variantConfig.schemeSuffix}`;
  const liveActivityBundleIdentifier = `${bundleIdentifier}.liveactivity`;

  const existingAppExtensions =
    config.extra?.eas?.build?.experimental?.ios?.appExtensions || [];
  const hasLiveActivityExtension = existingAppExtensions.some(
    (extension) => extension?.targetName === "liveactivity"
  );

  const appExtensions = hasLiveActivityExtension
    ? existingAppExtensions.map((extension) =>
        extension?.targetName === "liveactivity"
          ? { ...extension, bundleIdentifier: liveActivityBundleIdentifier }
          : extension
      )
    : [
        ...existingAppExtensions,
        {
          targetName: "liveactivity",
          bundleIdentifier: liveActivityBundleIdentifier,
          entitlements: {},
        },
      ];

  return {
    ...config,
    name: `${baseName}${variantConfig.nameSuffix}`,
    scheme,
    ios: {
      ...config.ios,
      bundleIdentifier,
      infoPlist: {
        ...config.ios?.infoPlist,
        UIViewControllerBasedStatusBarAppearance: false,
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: [scheme],
          },
          {
            CFBundleURLSchemes: [`exp+${scheme}`],
          },
        ],
      },
    },
    android: {
      ...config.android,
      package: androidPackage,
    },
    extra: {
      ...config.extra,
      eas: {
        ...config.extra?.eas,
        build: {
          ...config.extra?.eas?.build,
          experimental: {
            ...config.extra?.eas?.build?.experimental,
            ios: {
              ...config.extra?.eas?.build?.experimental?.ios,
              appExtensions,
            },
          },
        },
      },
    },
  };
};
