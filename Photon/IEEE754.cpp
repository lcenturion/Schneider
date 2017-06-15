#include "IEEE754.h"

double msg2dbl(uint16_t* au16data) {
    unsigned long BinaryDec = au16data[0] << 16;        //Two integer packages convert to one.
    BinaryDec += au16data[1];
    char Binary[32];
    for (int c = 31, k; c >= 0; c--)                    //Package converts to 32-bit binary package.
    {
        k = BinaryDec >> c;
        if (k & 1)
            Binary[31-c] = '1';
        else
            Binary[31-c] = '0';
    }
    bool negative  = !!(BinaryDec & 0x80000000);        //IEEE 754 package parsing.
    int  exponent  =   (BinaryDec & 0x7f800000) >> 23;
    int sign = negative ? -1 : 1;
    exponent -= 127;                                    //Conversion to double through mantissa, exponent and sign.
    int power = -1;
    double total = 0.0;
    for ( int i = 0; i < 23; i++ )
    {
        int c = Binary[ i + 9 ] - '0';
        total += (double) c * (double) pow( 2.0, power );
        power--;
    }
    total += 1.0;
    double value = sign * (double) pow( 2.0, exponent ) * total;
    return value;
}