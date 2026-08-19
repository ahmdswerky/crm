import type { ComponentProps } from "react"
import type { Country } from "react-phone-number-input"
import { PhoneInput } from "@/components/reui/phone-input"

type PhoneFieldProps = Omit<ComponentProps<typeof PhoneInput>, "defaultCountry" | "onChange" | "value"> & {
  value: string
  onValueChange: (value: string) => void
  defaultCountry?: Country
}

export function PhoneField({ value, onValueChange, defaultCountry = "EG", ...props }: PhoneFieldProps) {
  return <PhoneInput defaultCountry={defaultCountry} value={value || undefined} onChange={(nextValue) => onValueChange(nextValue || "")} {...props} />
}
