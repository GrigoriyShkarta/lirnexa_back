import { PartialType } from '@nestjs/swagger';
import { CreatePersonalEventDto } from './create-personal-event.dto';

export class UpdatePersonalEventDto extends PartialType(CreatePersonalEventDto) {}
