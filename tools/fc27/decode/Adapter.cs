namespace FrostyAnimationEditor.Core {
    public class GdException : Exception { public GdException(string message) : base(message) {} }
    public static class Num {
        public static long ToLong(object value) => Convert.ToInt64(value);
        public static float ToFloat(object value) => Convert.ToSingle(value);
    }
    public static class BE {
        public static uint U32LE(byte[] data, int offset) => BitConverter.ToUInt32(data, offset);
    }
    // The functional field getter is used. The GdStruct overload is never invoked.
    public class GdStruct {
        public object this[string key] => null;
        public float GetFloat(string key) => 0;
        public bool GetBool(string key) => false;
    }
    public static class PyFormat { public static double Floor(double value) => Math.Floor(value); }
}
