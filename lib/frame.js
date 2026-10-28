// "Frame" là kết quả biến đổi của một khung hình.
// Mọi hiệu ứng đang bật cùng ghi vào đây, engine tổng hợp rồi áp lên actor.
//
// Quy ước:
//   rotationZ : cộng dồn (độ)
//   scaleX/Y  : nhân dồn (1 = không đổi)
//   opacity   : 0..255, hiệu ứng lấy giá trị nhỏ hơn
//
// Hiệu ứng mới có thể góp thêm thuộc tính nếu engine được mở rộng tương ứng.

export class Frame {
    constructor() {
        this.reset();
    }

    reset() {
        this.rotationX = 0;
        this.rotationY = 0;
        this.rotationZ = 0;
        this.scaleX = 1;
        this.scaleY = 1;
        this.opacity = 255;
    }
}
