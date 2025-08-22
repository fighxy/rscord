use regex::Regex;
use once_cell::sync::Lazy;

static USERNAME_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^[a-z0-9_]{3,20}$").unwrap()
});

static RESERVED_USERNAMES: &[&str] = &[
    "admin", "administrator", "mod", "moderator", "root", "system", 
    "support", "help", "api", "bot", "radiate", "discord", "slack",
    "everyone", "here", "channel", "guild", "server", "user",
    "null", "undefined", "void", "test", "demo", "guest",
    "www", "mail", "ftp", "ssh", "http", "https", "smtp", "imap"
];

#[derive(Debug, thiserror::Error)]
pub enum UsernameValidationError {
    #[error("Username must be between 3 and 20 characters long")]
    InvalidLength,
    #[error("Username can only contain lowercase letters, numbers, and underscores")]
    InvalidCharacters,
    #[error("Username '{0}' is reserved and cannot be used")]
    Reserved(String),
    #[error("Username cannot start with underscore")]
    StartsWithUnderscore,
    #[error("Username cannot end with underscore")]
    EndsWithUnderscore,
    #[error("Username cannot contain consecutive underscores")]
    ConsecutiveUnderscores,
}

pub fn validate_username(username: &str) -> Result<String, UsernameValidationError> {
    let username = username.trim().to_lowercase();
    
    // Check length
    if username.len() < 3 || username.len() > 20 {
        return Err(UsernameValidationError::InvalidLength);
    }
    
    // Check pattern
    if !USERNAME_REGEX.is_match(&username) {
        return Err(UsernameValidationError::InvalidCharacters);
    }
    
    // Check reserved usernames
    if RESERVED_USERNAMES.contains(&username.as_str()) {
        return Err(UsernameValidationError::Reserved(username));
    }
    
    // Check underscore rules
    if username.starts_with('_') {
        return Err(UsernameValidationError::StartsWithUnderscore);
    }
    
    if username.ends_with('_') {
        return Err(UsernameValidationError::EndsWithUnderscore);
    }
    
    // Check for consecutive underscores
    if username.contains("__") {
        return Err(UsernameValidationError::ConsecutiveUnderscores);
    }
    
    Ok(username)
}

pub fn is_valid_username(username: &str) -> bool {
    validate_username(username).is_ok()
}

pub fn suggest_username(display_name: &str) -> String {
    let mut suggestion = display_name
        .trim()
        .to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '_')
        .collect::<String>();
    
    // Remove leading/trailing underscores
    suggestion = suggestion.trim_matches('_').to_string();
    
    // Replace consecutive underscores
    while suggestion.contains("__") {
        suggestion = suggestion.replace("__", "_");
    }
    
    // Ensure minimum length
    if suggestion.len() < 3 {
        suggestion = format!("user_{}", ulid::Ulid::new().to_string()[..8].to_lowercase());
    }
    
    // Ensure maximum length
    if suggestion.len() > 20 {
        suggestion.truncate(20);
        suggestion = suggestion.trim_end_matches('_').to_string();
    }
    
    // If it's reserved, add suffix
    if RESERVED_USERNAMES.contains(&suggestion.as_str()) {
        suggestion = format!("{}_user", suggestion);
        if suggestion.len() > 20 {
            suggestion = format!("user_{}", ulid::Ulid::new().to_string()[..8].to_lowercase());
        }
    }
    
    suggestion
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_valid_usernames() {
        assert!(is_valid_username("tmwind"));
        assert!(is_valid_username("user123"));
        assert!(is_valid_username("test_user"));
        assert!(is_valid_username("abc"));
        assert!(is_valid_username("abcdefghij1234567890")); // 20 chars
    }
    
    #[test]
    fn test_invalid_usernames() {
        // Too short
        assert!(!is_valid_username("ab"));
        // Too long
        assert!(!is_valid_username("abcdefghij12345678901"));
        // Invalid characters
        assert!(!is_valid_username("user-name"));
        assert!(!is_valid_username("user.name"));
        assert!(!is_valid_username("User123"));
        assert!(!is_valid_username("user@name"));
        // Underscore rules
        assert!(!is_valid_username("_username"));
        assert!(!is_valid_username("username_"));
        assert!(!is_valid_username("user__name"));
        // Reserved
        assert!(!is_valid_username("admin"));
        assert!(!is_valid_username("system"));
    }
    
    #[test]
    fn test_username_suggestions() {
        assert_eq!(suggest_username("Test User"), "test_user");
        assert_eq!(suggest_username("User@123"), "user123");
        assert_eq!(suggest_username("ab"), "user_01hxaabt"); // Should be longer than 3 chars
    }
}