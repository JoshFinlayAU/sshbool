//! Domain error types.

use thiserror::Error;

/// Errors originating in the domain layer.
#[derive(Debug, Error)]
pub enum DomainError {
    /// Entity was not found.
    #[error("{entity} not found")]
    NotFound {
        /// Entity name.
        entity: &'static str,
        /// Optional id.
        id: Option<String>,
    },
    /// Validation failure.
    #[error("{field}: {message}")]
    Validation {
        /// Field name.
        field: String,
        /// Message.
        message: String,
    },
    /// Conflict / invariant violation.
    #[error("{0}")]
    Conflict(String),
    /// Vault is locked or password is wrong.
    #[error("unauthorized: {0}")]
    Unauthorized(&'static str),
    /// Cryptographic failure.
    #[error("crypto: {0}")]
    Crypto(String),
    /// Operation was canceled by the user.
    #[error("canceled")]
    Canceled,
    /// Host fingerprint needs verification before connection.
    #[error("fingerprint_unknown")]
    FingerprintUnknown {
        /// Target hostname or IP.
        host: String,
        /// Target port.
        port: u16,
        /// SHA-256 fingerprint string.
        fingerprint: String,
        /// MD5 fingerprint string (formatted hex pairs).
        fingerprint_md5: Option<String>,
        /// Key algorithm type.
        key_type: String,
    },
    /// Host key has changed compared to known_hosts.
    #[error("host_key_changed")]
    HostKeyChanged {
        /// Target hostname or IP.
        host: String,
        /// Expected fingerprint string.
        expected: String,
        /// Actual fingerprint string.
        actual: String,
    },
}
