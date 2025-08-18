use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use crate::audio::{AudioError, AudioResult};

/// Lock-free ring buffer optimized for audio data
/// This implementation is designed for single-producer, single-consumer scenarios
/// which is typical for audio processing pipelines
pub struct AudioRingBuffer<T> {
    buffer: Vec<T>,
    capacity: usize,
    read_pos: AtomicUsize,
    write_pos: AtomicUsize,
}

impl<T: Default + Clone + Copy> AudioRingBuffer<T> {
    /// Create a new ring buffer with the specified capacity
    /// Capacity will be rounded up to the next power of 2 for efficiency
    pub fn new(capacity: usize) -> Self {
        let actual_capacity = capacity.next_power_of_two();
        
        AudioRingBuffer {
            buffer: vec![T::default(); actual_capacity],
            capacity: actual_capacity,
            read_pos: AtomicUsize::new(0),
            write_pos: AtomicUsize::new(0),
        }
    }
    
    /// Write data to the ring buffer
    /// Returns the number of elements actually written
    pub fn write(&self, data: &[T]) -> AudioResult<usize> {
        if data.is_empty() {
            return Ok(0);
        }
        
        let write_pos = self.write_pos.load(Ordering::Acquire);
        let read_pos = self.read_pos.load(Ordering::Acquire);
        
        // Calculate available space
        let available_space = self.available_write_space(write_pos, read_pos);
        
        if available_space == 0 {
            return Err(AudioError::ring_buffer("Buffer full"));
        }
        
        let to_write = std::cmp::min(data.len(), available_space);
        
        // Handle wrap-around case
        let end_of_buffer = self.capacity - write_pos;
        
        if to_write <= end_of_buffer {
            // No wrap-around needed
            unsafe {
                let dst = self.buffer.as_ptr().add(write_pos) as *mut T;
                std::ptr::copy_nonoverlapping(data.as_ptr(), dst, to_write);
            }
        } else {
            // Need to wrap around
            let first_chunk = end_of_buffer;
            let second_chunk = to_write - first_chunk;
            
            unsafe {
                // Write first chunk to end of buffer
                let dst1 = self.buffer.as_ptr().add(write_pos) as *mut T;
                std::ptr::copy_nonoverlapping(data.as_ptr(), dst1, first_chunk);
                
                // Write second chunk to beginning of buffer
                let dst2 = self.buffer.as_ptr() as *mut T;
                std::ptr::copy_nonoverlapping(
                    data.as_ptr().add(first_chunk),
                    dst2,
                    second_chunk
                );
            }
        }
        
        // Update write position
        let new_write_pos = (write_pos + to_write) & (self.capacity - 1);
        self.write_pos.store(new_write_pos, Ordering::Release);
        
        Ok(to_write)
    }
    
    /// Read data from the ring buffer
    /// Returns the number of elements actually read
    pub fn read(&self, output: &mut [T]) -> AudioResult<usize> {
        if output.is_empty() {
            return Ok(0);
        }
        
        let read_pos = self.read_pos.load(Ordering::Acquire);
        let write_pos = self.write_pos.load(Ordering::Acquire);
        
        // Calculate available data
        let available_data = self.available_read_data(read_pos, write_pos);
        
        if available_data == 0 {
            return Ok(0);  // No data available, not an error
        }
        
        let to_read = std::cmp::min(output.len(), available_data);
        
        // Handle wrap-around case
        let end_of_buffer = self.capacity - read_pos;
        
        if to_read <= end_of_buffer {
            // No wrap-around needed
            unsafe {
                let src = self.buffer.as_ptr().add(read_pos);
                std::ptr::copy_nonoverlapping(src, output.as_mut_ptr(), to_read);
            }
        } else {
            // Need to wrap around
            let first_chunk = end_of_buffer;
            let second_chunk = to_read - first_chunk;
            
            unsafe {
                // Read first chunk from end of buffer
                let src1 = self.buffer.as_ptr().add(read_pos);
                std::ptr::copy_nonoverlapping(src1, output.as_mut_ptr(), first_chunk);
                
                // Read second chunk from beginning of buffer
                let src2 = self.buffer.as_ptr();
                std::ptr::copy_nonoverlapping(
                    src2,
                    output.as_mut_ptr().add(first_chunk),
                    second_chunk
                );
            }
        }
        
        // Update read position
        let new_read_pos = (read_pos + to_read) & (self.capacity - 1);
        self.read_pos.store(new_read_pos, Ordering::Release);
        
        Ok(to_read)
    }
    
    /// Try to write data without blocking
    /// Returns Ok(written_count) or Err if buffer is full
    pub fn try_write(&self, data: &[T]) -> AudioResult<usize> {
        self.write(data)
    }
    
    /// Try to read data without blocking
    /// Returns Ok(read_count) even if no data is available
    pub fn try_read(&self, output: &mut [T]) -> AudioResult<usize> {
        self.read(output)
    }
    
    /// Get the number of elements available for reading
    pub fn available_read(&self) -> usize {
        let read_pos = self.read_pos.load(Ordering::Acquire);
        let write_pos = self.write_pos.load(Ordering::Acquire);
        self.available_read_data(read_pos, write_pos)
    }
    
    /// Get the number of elements available for writing
    pub fn available_write(&self) -> usize {
        let write_pos = self.write_pos.load(Ordering::Acquire);
        let read_pos = self.read_pos.load(Ordering::Acquire);
        self.available_write_space(write_pos, read_pos)
    }
    
    /// Check if the buffer is empty
    pub fn is_empty(&self) -> bool {
        let read_pos = self.read_pos.load(Ordering::Acquire);
        let write_pos = self.write_pos.load(Ordering::Acquire);
        read_pos == write_pos
    }
    
    /// Check if the buffer is full
    pub fn is_full(&self) -> bool {
        self.available_write() == 0
    }
    
    /// Get the total capacity of the buffer
    pub fn capacity(&self) -> usize {
        self.capacity - 1  // We lose one slot to distinguish full from empty
    }
    
    /// Clear the buffer (reset read/write positions)
    pub fn clear(&self) {
        self.read_pos.store(0, Ordering::Release);
        self.write_pos.store(0, Ordering::Release);
    }
    
    /// Calculate available write space
    fn available_write_space(&self, write_pos: usize, read_pos: usize) -> usize {
        if write_pos >= read_pos {
            self.capacity - write_pos + read_pos - 1
        } else {
            read_pos - write_pos - 1
        }
    }
    
    /// Calculate available read data
    fn available_read_data(&self, read_pos: usize, write_pos: usize) -> usize {
        if write_pos >= read_pos {
            write_pos - read_pos
        } else {
            self.capacity - read_pos + write_pos
        }
    }
}

// Thread-safe wrapper for shared access
pub type SharedAudioRingBuffer<T> = Arc<AudioRingBuffer<T>>;

impl<T: Default + Clone + Copy> AudioRingBuffer<T> {
    /// Create a shared (Arc-wrapped) ring buffer
    pub fn new_shared(capacity: usize) -> SharedAudioRingBuffer<T> {
        Arc::new(Self::new(capacity))
    }
}

// Specialized type aliases for common audio data types
pub type AudioRingBufferI16 = AudioRingBuffer<i16>;
pub type AudioRingBufferF32 = AudioRingBuffer<f32>;
pub type AudioRingBufferU8 = AudioRingBuffer<u8>;

pub type SharedAudioRingBufferI16 = SharedAudioRingBuffer<i16>;
pub type SharedAudioRingBufferF32 = SharedAudioRingBuffer<f32>;
pub type SharedAudioRingBufferU8 = SharedAudioRingBuffer<u8>;

unsafe impl<T: Send> Send for AudioRingBuffer<T> {}
unsafe impl<T: Sync> Sync for AudioRingBuffer<T> {}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_ring_buffer_basic_operations() {
        let buffer = AudioRingBuffer::<i16>::new(1024);
        
        // Test writing
        let input_data = vec![1, 2, 3, 4, 5];
        let written = buffer.write(&input_data).unwrap();
        assert_eq!(written, 5);
        assert_eq!(buffer.available_read(), 5);
        
        // Test reading
        let mut output_data = vec![0i16; 3];
        let read = buffer.read(&mut output_data).unwrap();
        assert_eq!(read, 3);
        assert_eq!(output_data, vec![1, 2, 3]);
        assert_eq!(buffer.available_read(), 2);
    }
    
    #[test]
    fn test_ring_buffer_wrap_around() {
        let buffer = AudioRingBuffer::<i16>::new(8);  // Will be rounded to 8
        
        // Fill most of the buffer
        let input1 = vec![1, 2, 3, 4, 5, 6];
        buffer.write(&input1).unwrap();
        
        // Read some data to make space at the beginning
        let mut output = vec![0i16; 3];
        buffer.read(&mut output).unwrap();
        assert_eq!(output, vec![1, 2, 3]);
        
        // Write more data that will wrap around
        let input2 = vec![7, 8, 9, 10];
        let written = buffer.write(&input2).unwrap();
        assert!(written > 0);  // Should write at least some data
    }
    
    #[test]
    fn test_ring_buffer_full_condition() {
        let buffer = AudioRingBuffer::<i16>::new(4);  // Capacity will be 4, usable 3
        
        // Fill the buffer completely
        let input = vec![1, 2, 3];
        let written = buffer.write(&input).unwrap();
        assert_eq!(written, 3);
        assert!(buffer.is_full());
        
        // Try to write more data - should fail
        let more_input = vec![4, 5];
        let result = buffer.write(&more_input);
        assert!(result.is_err());
    }
    
    #[test]
    fn test_ring_buffer_empty_condition() {
        let buffer = AudioRingBuffer::<i16>::new(1024);
        assert!(buffer.is_empty());
        assert_eq!(buffer.available_read(), 0);
        
        // Reading from empty buffer should return 0, not error
        let mut output = vec![0i16; 10];
        let read = buffer.read(&mut output).unwrap();
        assert_eq!(read, 0);
    }
    
    #[test]
    fn test_ring_buffer_clear() {
        let buffer = AudioRingBuffer::<i16>::new(1024);
        
        // Write some data
        let input = vec![1, 2, 3, 4, 5];
        buffer.write(&input).unwrap();
        assert!(!buffer.is_empty());
        
        // Clear and verify
        buffer.clear();
        assert!(buffer.is_empty());
        assert_eq!(buffer.available_read(), 0);
    }
    
    #[test]
    fn test_ring_buffer_capacity_power_of_two() {
        let buffer = AudioRingBuffer::<i16>::new(1000);  // Not a power of 2
        
        // Should be rounded up to next power of 2 (1024)
        // Usable capacity is 1023 (one slot reserved)
        assert_eq!(buffer.capacity(), 1023);
    }
    
    #[test] 
    fn test_shared_ring_buffer() {
        let buffer = AudioRingBuffer::<i16>::new_shared(1024);
        
        // Test that it's actually shared (Arc)
        let buffer_clone = Arc::clone(&buffer);
        
        // Write from one reference
        let input = vec![1, 2, 3];
        buffer.write(&input).unwrap();
        
        // Read from another reference
        let mut output = vec![0i16; 3];
        let read = buffer_clone.read(&mut output).unwrap();
        assert_eq!(read, 3);
        assert_eq!(output, vec![1, 2, 3]);
    }
}