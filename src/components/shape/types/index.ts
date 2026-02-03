import {SVGAttributes} from 'react';

import Circle from './circle';
import RoundRectangle from './round-rectangle';
import Capsule from './capsule';
import Hexagon from './hexagon';

export const ShapeComponents = {
    circle: Circle,
    'round-rectangle': RoundRectangle,
    capsule: Capsule,
    hexagon: Hexagon,
};

export type ShapeType = keyof typeof ShapeComponents;

export type ShapeProps = {
    width: number;
    height: number;
} & SVGAttributes<SVGElement>;

export type ShapeComponentProps = Partial<ShapeProps> & { type: ShapeType };
