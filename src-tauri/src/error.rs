//! Typed AppError for IPC.

use domain::DomainError;
use serde::Serialize;

/// Discriminated error union returned to the frontend.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind")]
pub enum AppError {
    NotFound {
        entity: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        id: Option<String>,
    },
    Validation {
        field: String,
        message: String,
    },
    Conflict {
        message: String,
    },
    Unauthorized {
        reason: String,
    },
    Auth {
        method: String,
        message: String,
    },
    HostKeyChanged {
        expected: String,
        actual: String,
    },
    FingerprintUnknown {
        host: String,
        port: u16,
        fingerprint: String,
        #[serde(rename = "fingerprintMd5")]
        fingerprint_md5: Option<String>,
        #[serde(rename = "keyType")]
        key_type: String,
    },
    Connection {
        message: String,
        retryable: bool,
    },
    Transfer {
        #[serde(rename = "jobId")]
        job_id: String,
        message: String,
    },
    Db {
        engine: String,
        message: String,
    },
    Crypto {
        message: String,
    },
    Plugin {
        slug: String,
        message: String,
    },
    Io {
        message: String,
    },
    Internal {
        message: String,
    },
}

impl From<DomainError> for AppError {
    fn from(value: DomainError) -> Self {
        match value {
            DomainError::NotFound { entity, id } => Self::NotFound {
                entity: entity.into(),
                id,
            },
            DomainError::Validation { field, message } => Self::Validation { field, message },
            DomainError::Conflict(message) => {
                if message.contains("connection")
                    || message.contains("channel")
                    || message.contains("sftp")
                {
                    Self::Connection {
                        message,
                        retryable: true,
                    }
                } else {
                    Self::Conflict { message }
                }
            }
            DomainError::Unauthorized(reason) => Self::Unauthorized {
                reason: reason.into(),
            },
            DomainError::Crypto(message) => Self::Crypto { message },
            DomainError::Canceled => Self::Conflict {
                message: "canceled".into(),
            },
            DomainError::FingerprintUnknown {
                host,
                port,
                fingerprint,
                fingerprint_md5,
                key_type,
            } => Self::FingerprintUnknown {
                host,
                port,
                fingerprint,
                fingerprint_md5,
                key_type,
            },
            DomainError::HostKeyChanged {
                host: _,
                expected,
                actual,
            } => Self::HostKeyChanged { expected, actual },
        }
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{self:?}")
    }
}

impl std::error::Error for AppError {}
