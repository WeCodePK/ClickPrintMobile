// Shared name validation rules for profile-setup and edit-profile screens.
// Returns a single, prioritized hint describing the first rule being
// violated (or "" when the trimmed name is fully valid), plus a boolean
// `isValid` so callers can gate submit buttons without re-deriving rules.

export const NAME_MIN_LENGTH = 5;
export const NAME_MAX_LENGTH = 20;

export const isValidName = (rawValue) => {
	const trimmed = rawValue.trim();
	return (
		trimmed.length >= NAME_MIN_LENGTH &&
		trimmed.length <= NAME_MAX_LENGTH &&
		/^[A-Za-z\s]+$/.test(trimmed) &&
		!/\s{2,}/.test(trimmed)
	);
};

export const getNameHint = (rawValue) => {
	const trimmed = rawValue.trim();

	if (rawValue.length === 0) return "";
	if (trimmed.length === 0) return "Name cannot be just spaces.";
	if (!/^[A-Za-z\s]+$/.test(trimmed)) return "Only letters and spaces are allowed.";
	if (/\s{2,}/.test(trimmed)) return "Name cannot contain multiple consecutive spaces.";
	if (trimmed.length < NAME_MIN_LENGTH) return `Name must be at least ${NAME_MIN_LENGTH} characters.`;
	if (trimmed.length > NAME_MAX_LENGTH) return `Name must be at most ${NAME_MAX_LENGTH} characters.`;
	return "";
};
