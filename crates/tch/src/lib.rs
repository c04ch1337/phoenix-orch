//! Minimal pure-Rust stub of the `tch` crate used by the Phoenix kernel.
//!
//! This crate provides just enough API surface for the current codebase to
//! compile in environments without libtorch or native system libraries.
//! It is **not** a real tensor library and should be treated as a temporary
//! compatibility layer until a full pure-Rust ML backend is integrated.

/// Minimal stand‑in for the `tch::nn` module.
pub mod nn {
    /// Minimal stand‑in for `tch::nn::Module`.
    #[derive(Debug, Default, Clone)]
    pub struct Module;

    impl Module {
        /// Pretend to load a module from disk.
        ///
        /// The stub implementation ignores the path and device and simply
        /// returns an empty `Module` instance.
        pub fn load<P, D>(_path: P, _device: D) -> Result<Self, crate::TchError>
        where
            P: AsRef<std::path::Path>,
        {
            Ok(Self)
        }

        /// Minimal forward pass.
        ///
        /// The stub implementation is identity: it returns a clone of the
        /// input tensor without performing any computation.
        pub fn forward(&self, input: &crate::Tensor) -> Result<crate::Tensor, crate::TchError> {
            Ok(input.clone())
        }
    }
}

/// Minimal device enumeration.
///
/// In the real `tch` crate this abstracts CPU/GPU placement. The stub only
/// models a CPU device and ignores all hardware details.
#[derive(Debug, Clone, Copy)]
pub enum Device {
    /// CPU device.
    Cpu,
}

impl Device {
    /// Returns the "best" available device.
    ///
    /// The real implementation prefers CUDA when available; the stub always
    /// returns `Device::Cpu` to avoid any native dependencies.
    pub fn cuda_if_available() -> Device {
        Device::Cpu
    }
}

/// Extremely small tensor type.
///
/// This is only meant to satisfy type signatures. It stores a flat vector
/// of `f32` values and does not implement any real tensor algebra.
#[derive(Debug, Clone)]
pub struct Tensor {
    data: Vec<f32>,
}

impl Tensor {
    /// Create a tensor from a slice.
    pub fn from_slice(data: &[f32]) -> Tensor {
        Tensor {
            data: data.to_vec(),
        }
    }

    /// Create a zero‑filled tensor for a given shape.
    ///
    /// The total length is the product of all dimensions in `shape`.
    pub fn zeros(shape: &[i64]) -> Tensor {
        let len: usize = shape
            .iter()
            .copied()
            .filter(|d| *d > 0)
            .product::<i64>() as usize;
        Tensor { data: vec![0.0; len] }
    }

    /// Access the underlying data for debugging or simple computations.
    pub fn data(&self) -> &[f32] {
        &self.data
    }
}

/// Minimal error type used by the stub.
#[derive(Debug, Clone)]
pub struct TchError {
    /// Human‑readable message.
    pub message: String,
}

impl TchError {
    /// Create a new error with the given message.
    pub fn new(msg: impl Into<String>) -> Self {
        Self { message: msg.into() }
    }
}

impl std::fmt::Display for TchError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "tch stub error: {}", self.message)
    }
}

impl std::error::Error for TchError {}

/// Convenient result alias following the real crate’s convention.
pub type Result<T> = std::result::Result<T, TchError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tensor_roundtrip() {
        let t = Tensor::from_slice(&[1.0, 2.0, 3.0]);
        assert_eq!(t.data(), &[1.0, 2.0, 3.0]);
    }

    #[test]
    fn module_forward_identity() {
        let m = nn::Module::default();
        let input = Tensor::from_slice(&[0.0, 1.0]);
        let out = m.forward(&input).unwrap();
        assert_eq!(out.data(), input.data());
    }
}
