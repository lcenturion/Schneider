#ifndef IEEE754_H
#define IEEE754_H 

#include <math.h>
#include "application.h"
#define _USE_MATH_DEFINES
//Receives: Decimal packages.
//Returns: Float values converted by IEEE 754.
double  msg2dbl(uint16_t*);
#endif