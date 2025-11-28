//! PyTorch bindings for Rust with optional libtorch dependency

#![allow(unused_variables)]

#[cfg(not(feature = "torch"))]
mod stub {
    /// Neural network module
    pub mod nn {
        /// Neural network module type
        #[derive(Debug, Clone)]
        pub struct Module;

        impl Module {
            /// Create a new module
            pub fn new() -> Self {
                Module
            }

            /// Forward pass
            pub fn forward(&self, _input: &super::Tensor) -> super::Tensor {
                super::Tensor::new()
            }
        }
    }

    /// Stub Tensor type
    #[derive(Debug, Clone)]
    pub struct Tensor;

    impl Tensor {
        /// Create a new empty tensor
        pub fn new() -> Self {
            Tensor
        }

        /// Create a tensor from a slice
        pub fn from_slice<T>(_data: &[T]) -> Self {
            Tensor
        }

        /// Get tensor data
        pub fn data(&self) -> Vec<f32> {
            Vec::new()
        }
    }

    /// Stub Device type
    #[derive(Debug, Clone, Copy)]
    pub enum Device {
        Cpu,
        Cuda(usize),
    }

    impl Device {
        /// Try to use CUDA if available, fallback to CPU
        pub fn cuda_if_available() -> Self {
            Device::Cpu
        }
    }

    /// Stub error type
    #[derive(Debug)]
    pub struct Error;

    impl std::fmt::Display for Error {
        fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
            write!(f, "Stub tch error")
        }
    }

    impl std::error::Error for Error {}

    /// Result type for tch operations
    pub type Result<T> = std::result::Result<T, Error>;
}

#[cfg(feature = "torch")]
pub use torch_sys::*;

#[cfg(not(feature = "torch"))]
pub use stub::*;
