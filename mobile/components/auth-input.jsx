import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

function EyeIcon({ off }) {
  return (
    <Svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#999"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {off ? (
        <>
          <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
          <Path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <Path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
          <Path d="M1 1l22 22" />
        </>
      ) : (
        <>
          <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <Circle cx={12} cy={12} r={3} />
        </>
      )}
    </Svg>
  );
}

// Native port of frontend/components/auth/AuthInput.jsx.
export default function AuthInput({
  label,
  value,
  onChangeText,
  onBlur,
  error,
  placeholder,
  autoCapitalize = "sentences",
  keyboardType = "default",
  secureTextEntry = false,
  autoComplete,
}) {
  const [visible, setVisible] = useState(false);
  const hidden = secureTextEntry && !visible;

  return (
    <View className="flex-col gap-1.5">
      <Text className="text-sm font-medium text-white">{label}</Text>
      <View className="relative">
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          placeholder={placeholder}
          placeholderTextColor="#999"
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          secureTextEntry={hidden}
          autoComplete={autoComplete}
          className={`w-full rounded-xl border bg-elevated px-3.5 py-3 text-[15px] text-white ${
            error ? "border-red-400" : "border-border"
          } ${secureTextEntry ? "pr-11" : ""}`}
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => setVisible((v) => !v)}
            accessibilityLabel={visible ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
          >
            <EyeIcon off={visible} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text className="text-[13px] leading-snug text-red-400">{error}</Text>
      ) : null}
    </View>
  );
}
