const { default: expoConfig } = await import("eslint-config-expo/flat.js");

export default [
  ...expoConfig,
  {
    rules: {
      "react/react-in-jsx-scope": "off",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-require-imports": "off",
      // Reanimated's useSharedValue intentionally returns a mutable box — .value = ... is the API
      "react-hooks/immutability": "off",
      // axios.create is the correct default export usage pattern
      "import/no-named-as-default-member": "off",
    },
  },
  {
    ignores: ["node_modules/**", "dist/**", ".expo/**", "android/**", "ios/**"],
  },
];
