import type { NotificationAudience } from "@/lib/notifications/types";
import { AdminSelect, type AdminSelectOption } from "./AdminSelect";
import { AdminUserPicker, type AdminUserOption } from "./AdminUserPicker";

const AUDIENCE_OPTIONS: AdminSelectOption[] = [
  { value: "all", label: "All students" },
  { value: "class", label: "Class" },
  { value: "users", label: "Selected students" },
];

type Props = {
  audienceType: NotificationAudience;
  onAudienceTypeChange: (value: NotificationAudience) => void;
  classId: string;
  onClassIdChange: (value: string) => void;
  classes: AdminSelectOption[];
  users: AdminUserOption[];
  selectedUserIds: string[];
  onSelectedUserIdsChange: (ids: string[]) => void;
};

export function AdminAudiencePicker({
  audienceType,
  onAudienceTypeChange,
  classId,
  onClassIdChange,
  classes,
  users,
  selectedUserIds,
  onSelectedUserIdsChange,
}: Props) {
  return (
    <div className="space-y-3">
      <AdminSelect
        label="Audience"
        value={audienceType}
        onValueChange={(v) => onAudienceTypeChange(v as NotificationAudience)}
        options={AUDIENCE_OPTIONS}
        placeholder="Who should receive this?"
      />

      {audienceType === "class" ? (
        <AdminSelect
          label="Class"
          value={classId}
          onValueChange={onClassIdChange}
          options={classes}
          placeholder="Select class"
        />
      ) : null}

      {audienceType === "users" ? (
        <AdminUserPicker
          label="Students"
          users={users}
          selectedIds={selectedUserIds}
          onChange={onSelectedUserIdsChange}
          placeholder="Pick one or more students"
        />
      ) : null}
    </div>
  );
}
