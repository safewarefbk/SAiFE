import {type ShapeProps} from '.';

function Capsule({width, height, ...svgAttributes}: ShapeProps) {
    return <rect x={0} y={0} rx={10} ry={40} width={40} height={20} {...svgAttributes} />;
}

export default Capsule;
